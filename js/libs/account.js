class Account {
  constructor(obj) {
    this.account = obj || {};
    this.maxAccountHistoryAmount = 100;
  }
  init() {
    this.info = steem.api.getAccountsAsync([this.account.name]);
    this.props = new GlobalProps();
    this.delegatees = getDelegatees(this.account.name);
    this.delegators = getDelegators(this.account.name);
    this.NFTS = getNFTList(this.account.name);
  }
  getObj() {
    return this.account;
  }
  getName() {
    return this.account.name;
  }
  getKeys() {
    return this.account.keys;
  }
  getKey(key) {
    return this.account.keys[key];
  }
  hasKey(key) {
    return this.account.keys.hasOwnProperty(key);
  }
  setKey(key, val) {
    this.account.keys[key] = val;
  }
  deleteKey(key) {
    delete this.account.keys[key];
    delete this.account.keys[`${key}Pubkey`];
  }
  async getAccountInfos() {
    return (await this.info)[0];
  }
  async getAccountInfo(key) {
    const info = (await this.info)[0];
    return info[key];
  }
  async getAvailableRewards() {
    this.reward_sbd = await this.getAccountInfo("reward_sbd_balance");
    this.reward_vests = await this.getAccountInfo("reward_vesting_balance");
    const reward_sp = (await this.toSP(this.reward_vests)) + " SP";
    this.reward_steem = await this.getAccountInfo("reward_steem_balance");
    let rewardText = chrome.i18n.getMessage("popup_account_redeem") + ":<br>";
    if (getValFromString(reward_sp) != 0) rewardText += reward_sp + " / ";
    if (getValFromString(this.reward_sbd) != 0)
      rewardText += this.reward_sbd + " / ";
    if (getValFromString(this.reward_steem) != 0)
      rewardText += this.reward_steem + " / ";
    rewardText = rewardText.slice(0, -3);
    return [this.reward_sbd, reward_sp, this.reward_steem, rewardText];
  }
  async toSP(vests) {
    return steem.formatter
      .vestToSteem(
        vests,
        await this.props.getProp("total_vesting_shares"),
        await this.props.getProp("total_vesting_fund_steem")
      )
      .toFixed(3);
  }

  claimRewards(callback) {
    steem.broadcast.claimRewardBalance(
      this.getKey("posting"),
      this.getName(),
      this.reward_steem,
      this.reward_sbd,
      this.reward_vests,
      callback
    );
  }

  async getVotingMana() {
    const vm = await getVotingMana(await this.getAccountInfos());
    const full = getTimeBeforeFull(vm * 100);
    return [vm, full];
  }

  async getSteem() {
    return (await this.getAccountInfo("balance")).replace(" STEEM", "");
  }

  async getSBD() {
    return (await this.getAccountInfo("sbd_balance")).replace(" SBD", "");
  }

  async getSP() {
    return await this.toSP(
      (await this.getAccountInfo("vesting_shares")).replace(" VESTS", "")
    );
  }

  async getRC() {
    return await getRC(this.account.name);
  }

  async getVotingDollars(percentage) {
    return await getVotingDollarsPerAccount(
      percentage,
      await this.getAccountInfos(),
      (await this.props.getFund("reward_balance")).replace("STEEM", ""),
      (await this.props.getFund("recent_claims")).replace("STEEM", ""),
      await this.props.getSteemPrice(),
      await this.props.getProp("vote_power_reserve_rate"),
      false
    );
  }

  async getAccountValue() {
    const [steem, sbd] = await this.props.getPrices();
    return (
      numberWithCommas(
        "$ " +
          (
            sbd * parseInt(await this.getSBD()) +
            steem *
              (parseInt(await this.getSP()) + parseInt(await this.getSteem()))
          ).toFixed(2)
      ) + "\t  USD"
    );
  }

  async getAccountHistoryRange(start, count, account) {
    let array = [];

    try {
      debugger;
      const [lastblockno] = await Promise.all([
        steem.api.getAccountHistoryAsync(account, -1, 0),
      ]);
      const tryLength = Math.ceil(count / this.maxAccountHistoryAmount);

      for (let i = 0; i < tryLength; i++) {
        const beginIdx =
          lastblockno[0][0] -
          (tryLength - i - 1) * this.maxAccountHistoryAmount;
        // i == 0인 경우 총 가져와야할 수량의 짜투리 수량만 가져오게 한다.(501개인 경우 1개, 550개인 경우 50개)
        // getAccountHistory에는 99를 입력하면 100개를 가지고 온다.
        const getCount =
          this.maxAccountHistoryAmount -
          1 -
          (i == 0 && count % this.maxAccountHistoryAmount
            ? this.maxAccountHistoryAmount -
              (count % this.maxAccountHistoryAmount)
            : 0);

        const trxs = await steem.api.getAccountHistoryAsync(
          account,
          beginIdx,
          getCount
        );

        console.log(`Range:${trxs[0][0]} ~ ${trxs[trxs.length - 1][0]}`);

        array = array.concat([...trxs]);
      }

      console.log("array.length", array.length);
    } catch (err) {
      console.log(err);
      throw "fail to get account history(getAccountHistoryRange)";
    }

    return array;
  }

  async getTransfers() {
    const result = await this.getAccountHistoryRange(-1, 1000, this.getName());
    // const result = await steem.api.getAccountHistoryAsync(
    //   this.getName(),
    //   -1,
    //   1000
    // );
    let transfers = result.filter((tx) => tx[1].op[0] === "transfer");
    transfers = transfers.slice(-10).reverse();
    return transfers;
  }

  async getComments() {
    const result = await steem.api.getAccountHistoryAsync(
      this.getName(),
      -1,
      99
    );
    let transfers = result.filter(
      (tx) =>
        tx[1].op[0] === "comment" &&
        tx[1].op[1].parent_author !== "" &&
        tx[1].op[1].author !== this.getName()
    );
    transfers = transfers.slice(-30).reverse();
    return transfers;
  }

  async getPowerDown() {
    const totalSteem = Number(
      (await this.props.getProp("total_vesting_fund_steem")).split(" ")[0]
    );
    const totalVests = Number(
      (await this.props.getProp("total_vesting_shares")).split(" ")[0]
    );
    const withdrawn = (
      (((await this.getAccountInfo("withdrawn")) / totalVests) * totalSteem) /
      1000000
    ).toFixed(0);
    const total_withdrawing = (
      (((await this.getAccountInfo("to_withdraw")) / totalVests) * totalSteem) /
      1000000
    ).toFixed(0);
    const next_vesting_withdrawal = await this.getAccountInfo(
      "next_vesting_withdrawal"
    );
    return [withdrawn, total_withdrawing, next_vesting_withdrawal];
  }

  async powerDown(sp, callback) {
    const totalSteem = Number(
      (await this.props.getProp("total_vesting_fund_steem")).split(" ")[0]
    );
    const totalVests = Number(
      (await this.props.getProp("total_vesting_shares")).split(" ")[0]
    );
    let vestingShares = (parseFloat(sp) * totalVests) / totalSteem;
    vestingShares = vestingShares.toFixed(6);
    vestingShares = vestingShares.toString() + " VESTS";

    steem.broadcast.withdrawVesting(
      this.getKey("active"),
      this.getName(),
      vestingShares,
      callback
    );
  }

  powerUp(amount, to, callback) {
    steem.broadcast.transferToVesting(
      this.getKey("active"),
      this.getName(),
      to,
      amount,
      callback
    );
  }

  async getDelegatees() {
    const that = this;
    let delegatees = await this.delegatees;
    delegatees = delegatees.filter(function (elt) {
      return elt.vesting_shares != 0;
    });

    console.log("delegatees", delegatees);
    if (delegatees.length > 0)
      delegatees = await Promise.all(
        delegatees.map(async (elt) => {
          elt.sp = parseFloat(
            await this.toSP(
              parseFloat(elt.vesting_shares.replace(" VESTS", ""))
            )
          ).toFixed(3);
          return elt;
        })
      );
    return delegatees;
  }

  async getDelegators() {
    const that = this;

    let delegators = await this.delegators;
    delegators = delegators.filter(function (elt) {
      return elt.vesting_shares != 0;
    });

    console.log("delegators", delegators);
    if (delegators.length > 0)
      delegators = await Promise.all(
        delegators.map(async (elt) => {
          const sp = await that.toSP(elt.vesting_shares + " VESTS");
          elt.sp = parseFloat(sp).toFixed(3);
          return elt;
        })
      );
    return delegators;
  }

  async delegateSP(amount, to, callback) {
    const totalSteem = Number(
      (await this.props.getProp("total_vesting_fund_steem")).split(" ")[0]
    );
    const totalVests = Number(
      (await this.props.getProp("total_vesting_shares")).split(" ")[0]
    );
    let delegated_vest = (parseFloat(amount) * totalVests) / totalSteem;
    delegated_vest = delegated_vest.toFixed(6);
    delegated_vest = delegated_vest.toString() + " VESTS";
    steem.broadcast.delegateVestingShares(
      activeAccount.getKey("active"),
      activeAccount.getName(),
      to,
      delegated_vest,
      callback
    );
  }
}
