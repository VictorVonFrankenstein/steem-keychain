let mk = null;
let activeAccount;
const STEEMIT_VOTE_REGENERATION_SECONDS = 5 * 60 * 60 * 24;
let custom_created = false;
let manageKey,
  getPref = false;
let to_autocomplete = [];
let accountsList = new AccountsList();
//chrome.storage.local.remove("transfer_to");

$("#copied").hide();
$("#witness_votes").hide();

// Ask background if it is unlocked
getMK();

// Check if autolock and set it to background
function sendAutolock() {
  chrome.storage.local.get(["autolock"], function (items) {
    if (items.autolock != undefined) {
      $(".autolock input").prop("checked", false);
      $("#" + JSON.parse(items.autolock).type).prop("checked", true);
      $("#mn").val(JSON.parse(items.autolock).mn);
      setAutolock(items.autolock);
      $("#mn").css(
        "visibility",
        JSON.parse(items.autolock).type == "idle" ? "visible" : "hidden"
      );
    }
  });
}

function checkKeychainify() {
  chrome.storage.local.get(["keychainify_enabled"], function (items) {
    if (items.keychainify_enabled !== undefined) {
      $(".enable_keychainify input").prop("checked", items.keychainify_enabled);
    } else {
      $(".enable_keychainify input").prop("checked", false);
    }
  });
}

// Save autolock
$(".autolock").click(function () {
  $(".autolock input").prop("checked", false);
  $(this).find("input").prop("checked", "true");
  $("#mn").css(
    "visibility",
    $(this).find("input").attr("id") == "idle" ? "visible" : "hidden"
  );
});

// Save enable_keychainify
$(".enable_keychainify").click(function () {
  const enable_keychainify = $(this).find("input").prop("checked");
  $(this).find("input").prop("checked", !enable_keychainify);
  chrome.storage.local.set({
    keychainify_enabled: !enable_keychainify,
  });
});

// Saving autolock options
$("#save_autolock").click(function () {
  const autolock = JSON.stringify({
    type: $(".autolock input:checkbox:checked").eq(0).attr("id") || "default",
    mn: $("#mn").val() || 10,
  });
  chrome.storage.local.set({
    autolock: autolock,
  });
  console.log("set");
  setAutolock(autolock);
  initializeVisibility();
  initializeMainMenu();
});

// Lock the wallet and destroy traces of the mk
$("#lock").click(function () {
  sendMk(null);
  accountsList.save(mk);
  $("#back_forgot_settings").attr("id", "back_forgot");
  mk = null;
  showUnlock();
});

const sendMk = (mk) => {
  chrome.runtime.sendMessage({
    command: "sendMk",
    mk,
  });
};
// Unlock with masterkey and show the main menu
$("#submit_unlock").click(function () {
  chrome.storage.local.get(["accounts"], function (items) {
    const pwd = $("#unlock_pwd").val();
    const accs = decryptToJson(items.accounts, pwd);
    console.log(accs);
    if (accs) {
      mk = pwd;
      sendMk(mk);
      $(".error_div").html("");
      $(".error_div").hide();
      $("#unlock_pwd").val("");
      initializeMainMenu();
      initializeVisibility();
    } else {
      showError(chrome.i18n.getMessage("wrong_password"));
    }
  });
});

// If user forgot Mk, he can reset the wallet
$("#forgot_div button").click(function () {
  accountsList.clear();
  mk = null;
  $("#forgot_div").hide();
  $("#register").show();
});

// Registration confirmation
$("#submit_master_pwd").click(function () {
  if (acceptMP($("#master_pwd").val())) {
    if ($("#master_pwd").val() == $("#confirm_master_pwd").val()) {
      mk = $("#master_pwd").val();
      sendMk(mk);
      initializeMainMenu();
      $(".error_div").hide();
    } else {
      showError(chrome.i18n.getMessage("popup_password_mismatch"));
    }
  } else {
    showError(chrome.i18n.getMessage("popup_password_regex"));
  }
});
function acceptMP(mp) {
  return (
    mp.length >= 16 ||
    (mp.length >= 8 &&
      mp.match(/.*[a-z].*/) &&
      mp.match(/.*[A-Z].*/) &&
      mp.match(/.*[0-9].*/))
  );
}
// Set visibilities back to normal when coming back to main menu
function initializeMainMenu() {
  console.log("init");
  sendAutolock();
  checkKeychainify();
  manageKey = false;
  getPref = false;
  chrome.storage.local.get(
    ["accounts", "last_account", "rpc", "current_rpc", "transfer_to"],
    function (items) {
      to_autocomplete = items.transfer_to ? JSON.parse(items.transfer_to) : {};
      if (items.accounts)
        accountsList.init(
          decryptToJson(items.accounts, mk),
          items.last_account
        );
      loadRPC(items.current_rpc);
      console.log(accountsList.getList());
      $("#accounts").empty();
      if (!accountsList.isEmpty()) {
        $(".usernames").html("<select></select>");
        for (account of accountsList.getList()) {
          $(".usernames select").append(
            "<option>" + account.getName() + "</option>"
          );
        }
        $(".usernames select")
          .eq(0)
          .append(
            `<option name='add_account'>${chrome.i18n.getMessage(
              "popup_add_account"
            )}</option>`
          );
        initiateCustomSelect();
      } else {
        $("#main").hide();
        $("#register").hide();
        $("#create_new_account").show();
        $("#add_account_types_div").show();
        $("#add_account_types_div .back_enabled").addClass("back_disabled");
      }
    }
  );
}
// Show Confirmation window before transfer
$("#send_transfer").click(function () {
  confirmTransfer();
});

function confirmTransfer() {
  $("#confirm_send_div").show();
  $("#send_div").hide();
  const to = $("#recipient").val();
  const amount = $("#amt_send").val();
  const currency = $("#currency_send .select-selected").html();
  let memo = $("#memo_send").val();
  $("#from_conf_transfer").text("@" + activeAccount.getName());
  $("#to_conf_transfer").text("@" + to);
  $("#amt_conf_transfer").text(amount + " " + currency);
  $("#memo_conf_transfer").text(
    (memo == "" ? chrome.i18n.getMessage("popup_empty") : memo) +
      ((memo != "" && $("#encrypt_memo").prop("checked")) || memo[0] == "#"
        ? ` (${chrome.i18n.getMessage("popup_encrypted")})`
        : "")
  );
}

// Send STEEM or SBD to an user
$("#confirm_send_transfer").click(function () {
  showLoader();
  sendTransfer();
});

// Vote for witnesses
function voteFor(name) {
  if (activeAccount.hasKey("active")) {
    $("#" + name.replace(".", "_") + " img").attr(
      "src",
      "../images/loading.gif"
    );

    steem.broadcast.accountWitnessVote(
      activeAccount.getKey("active"),
      activeAccount.getName(),
      name,
      true,
      function (err, result) {
        if (err == null) {
          setTimeout(function () {
            if ($(".witness_container:visible").length == 0)
              $("#witness_votes").animate(
                {
                  opacity: 0,
                },
                500,
                function () {
                  $("#witness_votes").hide();
                }
              );
          }, 1000);

          $("#" + name.replace(".", "_") + " img").attr(
            "src",
            "../images/icon_witness-vote.svg"
          );
        }
      }
    );
  } else {
    $("#witness_votes").hide();
    $("#main").hide();
    $("#add_key_div").show();
    manageKey = true;
    manageKeys($(".usernames .select-selected").eq(0).html());
    showError(chrome.i18n.getMessage("popup_witness_key"));
  }
}

// Send a transfer
async function sendTransfer() {
  const to = $("#recipient").val().replace(" ", "");
  const amount = $("#amt_send").val();
  const currency = $("#currency_send .select-selected").html();
  let memo = $("#memo_send").val();
  if ((memo != "" && $("#encrypt_memo").prop("checked")) || memo[0] == "#") {
    try {
      const receiver = await steem.api.getAccountsAsync([to]);
      const memoReceiver = receiver["0"].memo_key;
      memo = memo[0] == "#" ? memo : "#" + memo;
      memo = window.encodeMemo(
        activeAccount.getKey("memo"),
        memoReceiver,
        memo
      );
    } catch (e) {
      console.log(e);
    }
  }
  if (to != "" && amount != "" && amount >= 0.001) {
    steem.broadcast.transfer(
      activeAccount.getKey("active"),
      activeAccount.getName(),
      to,
      parseFloat(amount).toFixed(3) + " " + currency,
      memo,
      async function (err, result) {
        $("#send_loader").hide();
        $("#confirm_send_transfer").show();
        if (err == null) {
          const sender = await steem.api.getAccountsAsync([
            activeAccount.getName(),
          ]);
          sbd = sender["0"].sbd_balance.replace("SBD", "");
          steem_p = sender["0"].balance.replace("STEEM", "");
          $("#confirm_send_div").hide();
          $("#send_div").show();
          if (currency == "SBD") {
            $(".transfer_balance div").eq(1).html(numberWithCommas(sbd));
          } else if (currency == "STEEM") {
            $(".transfer_balance div").eq(1).html(numberWithCommas(steem_p));
          }
          $(".error_div").hide();
          $(".success_div")
            .html(chrome.i18n.getMessage("popup_transfer_success"))
            .show();
          chrome.storage.local.get(
            { transfer_to: JSON.stringify({}) },
            function (items) {
              let transfer_to = JSON.parse(items.transfer_to);
              if (!transfer_to[activeAccount.getName()])
                transfer_to[activeAccount.getName()] = [];
              console.log(transfer_to);
              if (
                transfer_to[activeAccount.getName()].filter((elt) => {
                  return elt == to;
                }).length == 0
              )
                transfer_to[activeAccount.getName()].push(to);
              console.log(transfer_to);

              console.log(JSON.stringify(transfer_to));
              chrome.storage.local.set({
                transfer_to: JSON.stringify(transfer_to),
              });
            }
          );
          setTimeout(function () {
            $(".success_div").hide();
          }, 5000);
        } else {
          $(".success_div").hide();
          showError(chrome.i18n.getMessage("unknown_error"));
        }
        $("#send_transfer").show();
      }
    );
  } else {
    showError(chrome.i18n.getMessage("popup_accounts_fill"));
    $("#send_loader").hide();
    $("#send_transfer").show();
  }
}

// check for new account
$("#check_new_account_btn").on("click", async function () {
  try {
    $("#check_new_account_btn").hide();
    $("#check_account_loader").show();

    const inputAccount = $("#input_new_account").val();

    if (inputAccount.length < 3) {
      $("#check_new_account_result").text(
        chrome.i18n.getMessage("account_rule_over_3_chars")
      );
      $("#input_new_account").css("background-color", "darkorange");
      $("#check_new_account_result").css("color", "darkred");
      $("#input_new_account").focus();
      return;
    }

    const account = await steem.api.getAccountsAsync([inputAccount]);

    console.log("getaccounts async", account);

    if (account.length) {
      $("#check_new_account_result").text(
        chrome.i18n.getMessage("account_exists")
      );
      $("#input_new_account").css("background-color", "darkorange");
      $("#check_new_account_result").css("color", "darkred");
      $("#input_new_account").focus();
      return;
    } else {
      $("#check_new_account_result").text(
        chrome.i18n.getMessage("account_can_use")
      );
      $("#input_new_account").css("background-color", "green");
      $("#check_new_account_result").css("color", "green");
    }
  } catch (err) {
    console.log("check_new_account_btn error", err);
  } finally {
    $("#check_account_loader").hide();
    $("#check_new_account_btn").show();
  }
});

// create new account
$("#create_new_account_btn").on("click", async function () {
  try {
    $("#create_new_account_btn").hide();
    $("#create_account_loader").show();

    const account = $("#input_new_account").val();
    const pk = $("#input_pk").val();
    const pkAgain = $("#paste_inputed_pk").val();

    if (pk !== pkAgain) {
      $("#create_new_account_result").text(
        chrome.i18n.getMessage("account_not_match")
      );
      $("#create_new_account_result").css("color", "darkred");
      return;
    }

    if (!acceptMP(pk)) {
      $("#create_new_account_result").text(
        chrome.i18n.getMessage("account_against_rule")
      );
      $("#create_new_account_result").css("color", "darkred");
      return;
    }

    const result = await createNewAccount(account, pk);

    if (result.success) {
      // $("#create_new_account_result").text(
      //   "Created Account. You can use STEEMIT now!!"
      // );
      // $("#create_new_account_result").css("color", "green");

      const keys = steem.auth.getPrivateKeys(account, pk, [
        "posting",
        "active",
        "memo",
      ]);

      addAccount({
        name: account,
        keys: keys,
      });

      $("#created_account_name").val(account);
      $("#main").hide();
      $("#create_account_div").hide();
      $("#create_account_finished_div").show();
    } else {
      if (result.notPassRegex) {
        $("#create_new_account_result").text(
          chrome.i18n.getMessage("account_against_rule")
        );
        $("#create_new_account_result").css("color", "darkred");
      } else if (result.existAccount) {
        $("#create_new_account_result").text(
          chrome.i18n.getMessage("account_exists")
        );
        $("#create_new_account_result").css("color", "darkred");
      } else {
        $("#create_new_account_result").text(
          chrome.i18n.getMessage("account_fail_to_create")
        );
        $("#create_new_account_result").css("color", "darkred");
      }
    }
  } catch (err) {
    console.log("create_new_account_btn error", err);
    $("#create_new_account_result").text(
      chrome.i18n.getMessage("account_fail_to_create")
    );
    $("#create_new_account_result").css("color", "darkred");
  } finally {
    $("#create_account_loader").hide();
    $("#create_new_account_btn").show();
  }
});

$("#create_account_finished_btn").on("click", function () {
  window.close();
});
