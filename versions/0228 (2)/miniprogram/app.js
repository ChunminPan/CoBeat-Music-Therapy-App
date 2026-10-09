// app.js
App({
  globalData: {
    // 全局状态
    stage2Unlocked: false,
    userInfo: null
  },
  
  onLaunch() {
    // 小程序启动时
    console.log('Music Therapy App 启动');
    
    // 从本地存储读取解锁状态
    const unlocked = wx.getStorageSync('stage2Unlocked');
    if (unlocked) {
      this.globalData.stage2Unlocked = true;
    }
  },
  
  // 解锁 Stage 2
  unlockStage2() {
    this.globalData.stage2Unlocked = true;
    wx.setStorageSync('stage2Unlocked', true);
  },
  
  // 检查 Stage 2 是否解锁
  isStage2Unlocked() {
    return this.globalData.stage2Unlocked;
  }
});
