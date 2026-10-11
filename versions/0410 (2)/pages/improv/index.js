const subject = require('../../utils/subject');
const api = require('../../utils/api');
const app = getApp();
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
    noteCount: 0,
    
    // 当前作品ID（用于分享和加载详情）
    currentWorkId: ''
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

  onLoad(options) {
    // 用户验证：确保新用户先填写表单
    // if (!subject.requireSubjectProfile()) return;
    
    // 初始化音频
    this._initAudio();

    // 检查是否有id参数传入，用于加载已有作品
    if (options && options.id) {
      this.loadImprovById(options.id);
      return;
    }

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

  onShow() {
    this.init()
  },
  init:function(){
    if (app.globalData.user) {
      if(!app.globalData.user.nickname){
        wx.navigateTo({
          url: '/pages/intake/index?edit=1'
        });
      }else{
        // this.loadTrainingRecords();
      }
    } else {
      setTimeout(() => {
        this.init()
      }, 500)
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

  // 加载指定ID的即兴创作作品
  loadImprovById(id) {
    wx.showLoading({ title: '加载中' });
    api.getImprovById(id).then(res => {
      wx.hideLoading();
      
      if (res.data && res.data.grid && res.data.meta) {
        // 加载作品数据到页面
        const noteCount = res.data.grid.flat().filter(Boolean).length;
        this.setData({
          gridRows: res.data.grid,
          playbackSpeed: res.data.meta.playbackSpeed || this.data.playbackSpeed,
          savedWorkName: res.data.meta.name || '未命名作品',
          hasNotes: noteCount > 0,
          noteCount: noteCount,
          currentWorkId: id // 保存当前作品ID
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('[IMPROV] 加载作品详情失败', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      // 如果加载失败，初始化空网格
      const grid = Array(GRID_ROWS).fill(null).map(() => 
        Array(GRID_COLS).fill(false)
      );
      this.setData({ gridRows: grid });
    });
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
    
    const openid = app.globalData.user.openid;
    if (!openid) {
      wx.showToast({
        title: '请先登录',
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
    
    // 保存到服务器
    api.saveImprov({ openid: openid, ...this._buildExportPayload() }).then(res => {
      // 保存返回的作品ID
      if (res.data.id) {
        this.setData({ currentWorkId: res.data.id });
      }
    }).catch(err => {
      console.error('[IMPROV] 保存作品失败', err);
    });
  },

  // 分享作品（生成MP3并分享）
  shareWork() {
    wx.showLoading({ title: '正在生成音频...' });
    
    // 微信小程序的音频处理能力有限，这里使用模拟生成MP3的方式
    // 实际项目中需要使用专业的音频处理库或后端服务
    this._generateAudioFile()
      .then((filePath) => {
        wx.hideLoading();
        this._shareAudioFile(filePath);
      })
      .catch((err) => {
        wx.hideLoading();
        console.error('[IMPROV] 生成音频失败', err);
        wx.showToast({
          title: '生成音频失败',
          icon: 'none'
        });
      });
  },
  
  // 模拟生成音频文件
  _generateAudioFile() {
    return new Promise((resolve, reject) => {
      try {
        // 由于微信小程序环境限制，直接分享原始数据作为模拟
        const payload = this._buildExportPayload();
        const fileName = `melody_${Date.now()}.json`;
        const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
        
        // 将音乐数据保存为JSON文件
        wx.getFileSystemManager().writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
        
        // 延迟模拟音频生成过程
        setTimeout(() => {
          resolve(filePath);
        }, 1000);
      } catch (err) {
        reject(err);
      }
    });
  },
  
  // 分享音频文件
  _shareAudioFile(filePath) {
    wx.shareFileMessage({
      filePath: filePath,
      fileName: this.data.savedWorkName || '未命名作品.json',
      title: this.data.savedWorkName || '未命名作品',
      success: (res) => {
        wx.showToast({
          title: '分享成功',
          icon: 'success'
        });
      },
      fail: (res) => {
        wx.showToast({
          title: '分享失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 微信分享配置（发送给朋友）
  onShareAppMessage() {
    const workName = this.data.savedWorkName || '未命名作品';
    const workId = this.data.currentWorkId;
    
    return {
      title: `${workName} - 即兴创作作品`,
      path: `/pages/improv/index?id=${workId}`, // 分享时携带作品ID
      imageUrl: '/images/grid.png', // 分享图片
      success: function(res) {
        wx.showToast({
          title: '分享成功',
          icon: 'success'
        });
      },
      fail: function(res) {
        wx.showToast({
          title: '分享失败',
          icon: 'none'
        });
      }
    };
  },
  
  // 微信分享配置（分享到朋友圈）
  onShareTimeline() {
    const workName = this.data.savedWorkName || '未命名作品';
    const workId = this.data.currentWorkId;
    
    return {
      title: `${workName} - 即兴创作作品`,
      query: `id=${workId}`, // 分享时携带作品ID
      imageUrl: '/images/grid.png', // 分享图片
      success: function(res) {
      },
      fail: function(res) {
      }
    };
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
