// pages/melody-maker/index.js
const GRID_COLS = 16;
const GRID_ROWS = 8;
const NOTE_NAMES = ['C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4'];

Page({
  data: {
    // 网格数据
    gridRows: [],
    noteNames: NOTE_NAMES,
    
    // 播放状态
    isPlaying: false,
    currentStep: -1,
    playbackSpeed: 120,
    
    // Modal 状态
    showNamingModal: false,
    showExportModal: false,
    workName: '',
    savedWorkName: '',
    
    // 历史记录
    history: [],
    historyCount: 0,
    
    // 统计
    hasNotes: false,
    noteCount: 0
  },

  playTimer: null,

  onLoad() {
    // 初始化空网格
    const grid = Array(GRID_ROWS).fill(null).map(() => 
      Array(GRID_COLS).fill(false)
    );
    this.setData({ gridRows: grid });
  },

  onUnload() {
    this.stopPlay();
  },

  // 切换音符
  toggleNote(e) {
    const { row, col } = e.currentTarget.dataset;
    
    // 保存历史
    const history = [...this.data.history, JSON.parse(JSON.stringify(this.data.gridRows))];
    
    // 更新网格
    const newGrid = JSON.parse(JSON.stringify(this.data.gridRows));
    newGrid[row][col] = !newGrid[row][col];
    
    // 计算音符数量
    const noteCount = newGrid.flat().filter(Boolean).length;
    
    this.setData({
      gridRows: newGrid,
      history: history,
      historyCount: history.length,
      hasNotes: noteCount > 0,
      noteCount: noteCount
    });
  },

  // 播放/暂停
  togglePlay() {
    if (this.data.isPlaying) {
      this.stopPlay();
    } else {
      this.startPlay();
    }
  },

  // 开始播放
  startPlay() {
    if (!this.data.hasNotes) return;
    
    this.setData({
      isPlaying: true,
      currentStep: 0
    });

    const interval = (60 / this.data.playbackSpeed) * 1000 / 4; // 16分音符
    
    this.playTimer = setInterval(() => {
      const nextStep = (this.data.currentStep + 1) % GRID_COLS;
      this.setData({ currentStep: nextStep });
      
      // 播放当前列的音符（实际应用中调用音频 API）
      // this.playColumn(nextStep);
    }, interval);
  },

  // 停止播放
  stopPlay() {
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }
    
    this.setData({
      isPlaying: false,
      currentStep: -1
    });
  },

  // 速度调整
  onSpeedChange(e) {
    const speed = e.detail.value;
    this.setData({ playbackSpeed: speed });
    
    // 如果正在播放，重新开始以应用新速度
    if (this.data.isPlaying) {
      this.stopPlay();
      this.startPlay();
    }
  },

  // 撤销
  undo() {
    if (this.data.historyCount === 0) return;
    
    const history = [...this.data.history];
    const previous = history.pop();
    const noteCount = previous.flat().filter(Boolean).length;
    
    this.setData({
      gridRows: previous,
      history: history,
      historyCount: history.length,
      hasNotes: noteCount > 0,
      noteCount: noteCount
    });
  },

  // 清空网格
  clearGrid() {
    if (!this.data.hasNotes) return;
    
    // 保存历史
    const history = [...this.data.history, JSON.parse(JSON.stringify(this.data.gridRows))];
    
    // 清空
    const grid = Array(GRID_ROWS).fill(null).map(() => 
      Array(GRID_COLS).fill(false)
    );
    
    this.setData({
      gridRows: grid,
      history: history,
      historyCount: history.length,
      hasNotes: false,
      noteCount: 0
    });
  },

  // 保存草稿
  saveDraft() {
    if (!this.data.hasNotes) return;
    
    wx.showToast({
      title: '草稿已保存',
      icon: 'success'
    });
  },

  // 完成并导出
  handleComplete() {
    if (!this.data.hasNotes) return;
    
    this.setData({
      showNamingModal: true,
      workName: ''
    });
  },

  // 输入作品名
  onNameInput(e) {
    this.setData({ workName: e.detail.value });
  },

  // 保存作品
  saveWork() {
    if (!this.data.workName.trim()) {
      wx.showToast({
        title: '请输入作品名',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      savedWorkName: this.data.workName,
      showNamingModal: false,
      showExportModal: true
    });

    // 保存到本地存储
    wx.setStorageSync('recentWork', {
      hasData: true,
      name: this.data.workName,
      date: '今天'
    });
  },

  // 分享作品
  shareWork() {
    wx.showToast({
      title: '分享功能开发中',
      icon: 'none'
    });
  },

  // 关闭弹窗
  closeNamingModal() {
    this.setData({ showNamingModal: false });
  },

  closeExportModal() {
    this.setData({
      showExportModal: false,
      workName: ''
    });
  },

  // 返回
  onBack() {
    if (this.data.hasNotes) {
      wx.showModal({
        title: '提示',
        content: '返回会丢失未保存的内容，确定返回吗？',
        success: (res) => {
          if (res.confirm) {
            this.stopPlay();
            wx.navigateBack();
          }
        }
      });
    } else {
      this.stopPlay();
      wx.navigateBack();
    }
  },

  // 帮助
  onHelp() {
    wx.showModal({
      title: '即兴创作帮助',
      content: '点击格子放置音符，横轴是时间，纵轴是音高。点击播放按钮可以预览你的作品。',
      showCancel: false
    });
  },

  // 阻止事件冒泡
  stopPropagation() {}
});
