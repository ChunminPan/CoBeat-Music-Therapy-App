// pages/training-mode/index.js
const app = getApp();

Page({
  data: {
    stage2Unlocked: false
  },

  onLoad() {
    // 检查 Stage 2 解锁状态
    this.setData({
      stage2Unlocked: app.isStage2Unlocked()
    });
  },

  onShow() {
    // 每次显示时检查解锁状态（从 Stage 1 返回时可能已解锁）
    this.setData({
      stage2Unlocked: app.isStage2Unlocked()
    });
  },

  // 返回首页
  onBack() {
    wx.navigateBack();
  },

  // 帮助
  onHelp() {
    wx.showModal({
      title: '节拍训练帮助',
      content: 'Stage 1: 固定节拍训练，练习稳定性\nStage 2: 变速挑战，自适应难度调整',
      showCancel: false
    });
  },

  // 进入 Stage 1
  onStage1() {
    wx.navigateTo({
      url: '/pages/stage1/index'
    });
  },

  // 进入 Stage 2
  onStage2() {
    if (!this.data.stage2Unlocked) {
      wx.showToast({
        title: '请先完成 Stage 1',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: '/pages/stage2/index'
    });
  }
});
