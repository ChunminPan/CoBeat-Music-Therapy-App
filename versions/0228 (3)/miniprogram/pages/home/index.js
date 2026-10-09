Page({
  data: {
    recentTraining: { hasData: true, hitRate: 87, date: "今天 14:30" },
    recentWork: { hasData: true, name: "小星星变奏", date: "昨天" }
  },

  goSettings() {
    wx.showToast({ title: "设置页未接入", icon: "none" });
  },

  goTrainingMode() {
    wx.navigateTo({ url: "/pages/training-mode-select/index" });
  },

  goCreation() {
    wx.navigateTo({ url: "/pages/melody-maker/index" });
  },

  goRecords() {
    wx.showToast({ title: "记录页未接入", icon: "none" });
  }
});
