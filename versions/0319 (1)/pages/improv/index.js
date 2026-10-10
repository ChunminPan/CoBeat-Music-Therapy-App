const subject = require('../../utils/subject');

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


  // 音频上下文（每个音高一个，允许同时播放）
  _audioMap: null,

  _initAudio() {
    const noteToFile = {
      C5: '/audio/notes/C5.wav',
      B4: '/audio/notes/B4.wav',
      A4: '/audio/notes/A4.wav',
      G4: '/audio/notes/G4.wav',
      F4: '/audio/notes/F4.wav',
      E4: '/audio/notes/E4.wav',
      D4: '/audio/notes/D4.wav',
      C4: '/audio/notes/C4.wav'
    };

    const audioMap = {};
    Object.keys(noteToFile).forEach((note) => {
      const ctx = wx.createInnerAudioContext();
      ctx.src = noteToFile[note];
      ctx.obeyMuteSwitch = false;
      ctx.volume = 0.7;
      // iOS: 需要用户交互后才能播放；本页所有播放都由点击触发，满足要求
      audioMap[note] = ctx;
    });
    this._audioMap = audioMap;
  },

  _destroyAudio() {
    if (!this._audioMap) return;
    Object.keys(this._audioMap).forEach((k) => {
      try { this._audioMap[k].destroy(); } catch (e) {}
    });
    this._audioMap = null;
  },

  // 播放某一列的音符
  playColumn(colIdx) {
    if (!this._audioMap) return;
    const grid = this.data.gridRows;
    for (let rowIdx = 0; rowIdx < grid.length; rowIdx++) {
      if (grid[rowIdx][colIdx]) {
        const note = this.data.noteNames[rowIdx];
        const ctx = this._audioMap[note];
        if (!ctx) continue;
        try {
          ctx.stop();
          // stop 后立刻 play，确保从头播放
          ctx.play();
        } catch (e) {
          // ignore
        }
      }
    }
  },

  // 试听单个音高（编辑点格子时）
  _previewNote(noteName) {
    if (!this._audioMap || !noteName) return;
    const ctx = this._audioMap[noteName];
    if (!ctx) return;
    try {
      ctx.stop();
      ctx.play();
    } catch (e) {
      // ignore
    }
  },

  onLoad() {
    if (!subject.requireSubjectProfile()) return;
    // 初始化音频
    this._initAudio();

    // 初始化空网格
    const grid = Array(GRID_ROWS).fill(null).map(() => 
      Array(GRID_COLS).fill(false)
    );
    // 如果有草稿，优先加载
    const draft = wx.getStorageSync('melodyDraft');
    if (draft && draft.gridRows && draft.gridRows.length) {
      const noteCount = draft.gridRows.flat().filter(Boolean).length;
      this.setData({
        gridRows: draft.gridRows,
        playbackSpeed: draft.playbackSpeed || this.data.playbackSpeed,
        hasNotes: noteCount > 0,
        noteCount
      });
    } else {
      this.setData({ gridRows: grid });
    }
  },

  onUnload() {
    this.stopPlay();
    this._destroyAudio();
  },

  // 切换音符
  toggleNote(e) {
    const { row, col } = e.currentTarget.dataset;
    const rowIdx = Number(row);
    const colIdx = Number(col);

    // 编辑状态：点击格子立即试听该行音高（不影响 toggle 行为）
    if (!this.data.isPlaying) {
      const noteName = this.data.noteNames[rowIdx];
      this._previewNote(noteName);
    }

    // 保存历史
    const history = [...this.data.history, JSON.parse(JSON.stringify(this.data.gridRows))];

    // 更新网格
    const newGrid = JSON.parse(JSON.stringify(this.data.gridRows));
    newGrid[rowIdx][colIdx] = !newGrid[rowIdx][colIdx];

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

    // 立即播放第 1 步
    this.playColumn(0);

    const interval = (60 / this.data.playbackSpeed) * 1000 / 4; // 16分音符
    
    this.playTimer = setInterval(() => {
      const nextStep = (this.data.currentStep + 1) % GRID_COLS;
      this.setData({ currentStep: nextStep });
      
      // 播放当前列的音符
      this.playColumn(nextStep);
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

    wx.setStorageSync('melodyDraft', {
      gridRows: this.data.gridRows,
      playbackSpeed: this.data.playbackSpeed,
      noteNames: this.data.noteNames,
      savedAt: Date.now()
    });

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
      date: subject.formatRecentLabel(Date.now()),
      savedAt: Date.now(),
      subject: subject.getSubjectMeta()
    });
  },

  // 分享作品（小程序版本：复制 JSON 到剪贴板）
  shareWork() {
    const payload = this._buildExportPayload();
    wx.setClipboardData({
      data: JSON.stringify(payload, null, 2),
      success: () => wx.showToast({ title: '已复制 JSON', icon: 'success' }),
      fail: () => wx.showToast({ title: '复制失败', icon: 'none' })
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


  // 构建导出 JSON（保持字段稳定，便于研究记录）
  _buildExportPayload() {
    const payload = {
      meta: {
        type: 'improv',
        name: this.data.savedWorkName || '',
        gridCols: 16,
        gridRows: 8,
        playbackSpeed: this.data.playbackSpeed,
        noteNames: this.data.noteNames,
        noteCount: this.data.noteCount,
        createdAt: Date.now()
      },
      grid: this.data.gridRows
    };
    subject.attachSubjectMeta(payload);
    return payload;
  },
  // 阻止事件冒泡
  stopPropagation() {}
});
