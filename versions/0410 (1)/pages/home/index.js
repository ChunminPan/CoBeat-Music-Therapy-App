// pages/home/index.js
const app = getApp();
const subject = require('../../utils/subject');
const api = require('../../utils/api');

Page({
  data: {
    hasRecentData: true,
    activeTab: 'training', // 默认选中节拍训练
    trainingRecords: [], // 节拍训练记录列表
    improvRecords: [], // 即兴创作记录列表
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
    // if (!subject.requireSubjectProfile()) return;
    // if (app && typeof app.refreshSubjectProfile === 'function') app.refreshSubjectProfile();
    // this.loadRecentData();
  },

  onShow() {
    this.init()
    // if (!subject.requireSubjectProfile()) return;
    // this.loadRecentData();
  },
  init:function(){
    if (app.globalData.user) {
      if(!app.globalData.user.nickname){
        wx.navigateTo({
          url: '/pages/intake/index?edit=1'
        });
      }else{
        this.loadTrainingRecords();
      }
    } else {
      setTimeout(() => {
        this.init()
      }, 500)
    }
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
    console.log(111111111)
    wx.navigateTo({
      url: '/pages/records/index'
    });
  },

  // 设置
  onSettings() {
    // wx.navigateTo({
    //   url: '/pages/intake/index?edit=1'
    // });
  },

  // Tab切换
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    // 切换tab时如果数据为空则加载
    if (tab === 'training' && this.data.trainingRecords.length === 0) {
      this.loadTrainingRecords();
    } else if (tab === 'improv' && this.data.improvRecords.length === 0) {
      this.loadImprovRecords();
    }
  },

  // 加载节拍训练记录
  loadTrainingRecords() {
    api.getTraining().then(res => {
      if (res.code === 200 && res.data) {
        // 格式化记录，添加日期显示
        const formattedRecords = res.data.map(record => {
          return {
            ...record,
            meta: {
              ...record.meta,
              accuracy: Math.round(record.meta.accuracy*100),
              date: subject.formatRecentLabel(record.meta.createdAt || Date.now())
            }
          };
        });
        this.setData({ trainingRecords: formattedRecords });
      }
    }).catch(err => {
      console.error('[HOME] 获取节拍训练记录失败', err);
    });
  },

  // 加载即兴创作记录
  loadImprovRecords() {
    api.getImprov().then(res => {
      if (res.code === 200 && res.data) {
        // 格式化记录，添加日期显示
        const formattedRecords = res.data.map(record => {
          return {
            ...record,
            meta: {
              ...record.meta,
              date: subject.formatRecentLabel(parseInt(record.meta.createdAt) || Date.now())
            }
          };
        });
        this.setData({ improvRecords: formattedRecords });
      }
    }).catch(err => {
      console.error('[HOME] 获取即兴创作记录失败', err);
    });
  },

  // 查看详细记录
  onViewRecords() {
    wx.navigateTo({
      url: '/pages/records/index?type=' + this.data.activeTab
    });
  },
  
  // 点击即兴创作记录项，进入详情页
  onImprovItemTap(e) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({
        url: '/pages/improv/index?id=' + id
      });
    }
  }
});
