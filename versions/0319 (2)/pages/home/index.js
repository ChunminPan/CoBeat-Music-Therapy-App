// pages/home/index.js
const app = getApp();
const subject = require('../../utils/subject');

Page({
  data: {
    hasRecentData: true,
    recentTraining: {
      hasData: true,
      hitRate: 87,
      date: '今天 14:30'
    },
    recentWork: {
      hasData: true,
      name: '小星星变奏',
      date: '昨天'
    }
  },
  onLoad() {
    if (!subject.requireSubjectProfile()) return;
    if (app && typeof app.refreshSubjectProfile === 'function') app.refreshSubjectProfile();
    this.loadRecentData();
  },

  onShow() {
    if (!subject.requireSubjectProfile()) return;
    this.loadRecentData();
  },

  // 加载最近数据
  loadRecentData() {
    const recentTraining = wx.getStorageSync('recentTraining');
    const recentWork = wx.getStorageSync('recentWork');
    
    if (recentTraining || recentWork) {
      this.setData({
        hasRecentData: true,
        recentTraining: recentTraining || { hasData: false },
        recentWork: recentWork || { hasData: false }
      });
    } else {
      this.setData({
        hasRecentData: false
      });
    }
  },

  // 开始训练
  onStartTraining() {
    wx.navigateTo({
      url: '/pages/trainer/index'
    });
  },

  // 开始创作
  onStartCreation() {
    wx.navigateTo({
      url: '/pages/improv/index'
    });
  },

  // 查看记录
  onViewRecords() {
    wx.showToast({
      title: '记录列表开发中',
      icon: 'none'
    });
  },

  // 设置
  onSettings() {
    wx.navigateTo({
      url: '/pages/intake/index?edit=1'
    });
  }
});
