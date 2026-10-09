Page({
  data: {
    stage2Unlocked: false
  },

  goBack() { wx.navigateBack(); },

  openHelp() {
    wx.showModal({
      title: "帮助",
      content: "Stage 1：固定节拍练稳定；达标后解锁 Stage 2：变速挑战。",
      showCancel: false
    });
  },

  goStage1() {
    wx.navigateTo({ url: "/pages/stage1/index" });
  },

  goStage2() {
    if (!this.data.stage2Unlocked) return;
    wx.navigateTo({ url: "/pages/stage2/index" });
  }
});
