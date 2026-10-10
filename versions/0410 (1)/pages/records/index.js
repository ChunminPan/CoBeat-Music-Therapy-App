// pages/record-list/index.js
Page({
  data: {
    records: []      // 记录列表数据
  },

  onLoad() {
    this.loadRecords();
  },

  onShow() {
    // 每次显示页面时刷新（若其他页面可能更新记录）
    this.loadRecords();
  },

  // 模拟加载记录数据（实际可从本地缓存或全局获取）
  loadRecords() {
    // 这里生成一些示例数据，实际开发中替换为 wx.getStorageSync 或全局变量
    const mockRecords = [
      {
        id: 'rec1',
        name: '晨间节奏练习',
        date: '2025-03-18 10:30',
        noteCount: 24,
        color: '#8B9FDB'  // 主色
      },
      {
        id: 'rec2',
        name: '五声音阶尝试',
        date: '2025-03-19 15:45',
        noteCount: 16,
        color: '#F4A3A3'  // 柔和红
      },
      {
        id: 'rec3',
        name: '即兴蓝调片段',
        date: '2025-03-20 09:15',
        noteCount: 32,
        color: '#A3C9A8'  // 浅绿
      },
      {
        id: 'rec4',
        name: '练习曲第5号',
        date: '2025-03-20 20:20',
        noteCount: 48,
        color: '#E6B89C'  // 暖杏
      }
    ];
    // 实际开发可从storage读取，若无则使用mock
    this.setData({ records: mockRecords });
  },

  // 返回上一页
  onBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.switchTab({
          url: '/pages/index/index' // 默认返回首页，根据实际调整
        });
      }
    });
  },

  // 确认删除单条记录
  confirmDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除记录',
      content: '确定要删除这条练习记录吗？',
      confirmColor: '#c95a4f',
      confirmText: '删除',
      success: (res) => {
        if (res.confirm) {
          this.deleteRecordById(id);
        }
      }
    });
  },

  // 执行删除
  deleteRecordById(id) {
    const newRecords = this.data.records.filter(item => item.id !== id);
    this.setData({ records: newRecords });
    // 可选：同步到本地存储
    // wx.setStorageSync('records', newRecords);
    wx.showToast({
      title: '已删除',
      icon: 'success',
      duration: 1500
    });
  },

  // 清空所有记录（带二次确认）
  clearAllRecords() {
    if (this.data.records.length === 0) return;
    wx.showModal({
      title: '清空所有记录',
      content: '确定要清空全部记录吗？此操作不可恢复。',
      confirmColor: '#c95a4f',
      confirmText: '清空',
      success: (res) => {
        if (res.confirm) {
          this.setData({ records: [] });
          // wx.setStorageSync('records', []);
          wx.showToast({
            title: '已清空',
            icon: 'success',
            duration: 1500
          });
        }
      }
    });
  },

  // 可选：点击卡片进入详情（预留扩展）
  onCardTap(e) {
    // 可以跳转到详情页
    // const id = e.currentTarget.dataset.id;
    // wx.navigateTo({ url: `/pages/detail/index?id=${id}` });
  }
});