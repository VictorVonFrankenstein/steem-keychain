const setNFTs = async () => {
  console.log("SET NFTS", activeAccount);

  try {
    const myNFTs = await activeAccount.NFTS.then((r) => {
      return r;
    });

    const success = myNFTs.data.getMyNFTs.success;

    if (success) {
      const nftList = myNFTs.data.getMyNFTs.steempunksNFTs;
      let html = "";

      nftList.forEach((nft) => {
        html += `<div class="nft_div" nftid="${nft.id}" nftname="${nft.projectname}">`;
        html += `
                <img
                  class="nft_img"
                  src="https://www.steempunks.xyz/images/${nft.image_filename}"
                />
              </div>`;
      });

      $("#nft_list").html(html);

      // 클릭 후 전송은 나중에 구현
      //   $(".nft_div").on("click", function () {
      //     $("#nft_page").hide();
      //     showNFTDetail($(this).attr("nftid"));
      //     $("#nft_detail_page").show();
      //   });
    } else {
      $("#nft_list").html("Fail to get NFTs");
    }
  } catch (error) {
    console.log("myNFTs error myNFTs error", error);
    $("#nft_list").html("Fail to get NFTs");
  }
};

function showNFTDetail(nftid, nftprojectname = "steempunks") {
  let html = `<img
  class="nft_img"
  src="https://www.steempunks.xyz/images/punk${nftid}.png"
/>`;

  $("#nft_detail").html(html);
}
