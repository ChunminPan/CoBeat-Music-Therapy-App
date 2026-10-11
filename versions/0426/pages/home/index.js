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
    trainingCurrentPage: 1, // 节拍训练当前页数
    improvCurrentPage: 1, // 即兴创作当前页数
    trainingHasMore: true, // 节拍训练是否有更多数据
    improvHasMore: true, // 即兴创作是否有更多数据
    isLoading: false, // 是否正在加载数据
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
    // 切换tab时重置分页状态并加载数据
    if (tab === 'training') {
      this.setData({
        trainingCurrentPage: 1,
        trainingHasMore: true
      });
      this.loadTrainingRecords();
    } else if (tab === 'improv') {
      this.setData({
        improvCurrentPage: 1,
        improvHasMore: true
      });
      this.loadImprovRecords();
    }
  },
  
  // 触底加载更多
  onReachBottom() {
    const { activeTab } = this.data;
    if (activeTab === 'training' && this.data.trainingHasMore && !this.data.isLoading) {
      this.loadTrainingRecords(true); // true表示追加数据
    } else if (activeTab === 'improv' && this.data.improvHasMore && !this.data.isLoading) {
      this.loadImprovRecords(true); // true表示追加数据
    }
  },

  // 加载节拍训练记录
  loadTrainingRecords(append = false) {
    if (this.data.isLoading || (!append && !this.data.trainingHasMore)) return;
    
    const page = append ? this.data.trainingCurrentPage + 1 : 1;
    
    this.setData({ isLoading: true });
    
    api.getTraining({ page }).then(res => {
      if (res.code === 200 && res.data) {
        // 格式化记录，添加日期显示
        const formattedRecords = res.data.map(record => {
          return {
            ...record,
            meta: {
              ...record.meta,
              accuracy: Math.round(record.meta.accuracy*100),
              childAccuracy: Math.round(record.meta.childAccuracy*100),
              date: subject.formatRecentLabel(record.created_at?record.created_at*1000 : Date.now())
            }
          };
        });
        
        const newRecords = append ? this.data.trainingRecords.concat(formattedRecords) : formattedRecords;
        const hasMore = res.original && res.original.data && res.original.data.data && res.original.data.data.length > 0;
        
        this.setData({
          trainingRecords: newRecords,
          trainingCurrentPage: page,
          trainingHasMore: hasMore,
          isLoading: false
        });
      } else {
        this.setData({ isLoading: false, trainingHasMore: false });
      }
    }).catch(err => {
      console.error('[HOME] 获取节拍训练记录失败', err);
      this.setData({ isLoading: false });
    });
  },

  // 加载即兴创作记录
  loadImprovRecords(append = false) {
    if (this.data.isLoading || (!append && !this.data.improvHasMore)) return;
    
    const page = append ? this.data.improvCurrentPage + 1 : 1;
    
    this.setData({ isLoading: true });
    
    api.getImprov({ page }).then(res => {
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
        
        const newRecords = append ? this.data.improvRecords.concat(formattedRecords) : formattedRecords;
        const hasMore = res.original && res.original.data && res.original.data.data && res.original.data.data.length > 0;
        
        this.setData({
          improvRecords: newRecords,
          improvCurrentPage: page,
          improvHasMore: hasMore,
          isLoading: false
        });
      } else {
        this.setData({ isLoading: false, improvHasMore: false });
      }
    }).catch(err => {
      console.error('[HOME] 获取即兴创作记录失败', err);
      this.setData({ isLoading: false });
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
