// pages/stage1/index.js
const app = getApp();

Page({
  data: {
    // 训练配置
    bpm: 72,
    tolMs: 200,
    trainingDuration: 60, // 秒

    // 训练状态
    phase: 'countdown', // countdown, training, paused, completed
    countdown: 3,
    timeRemaining: 60,
    progress: 0,

    // 节拍状态
    orbState: 'default', // default, hit, miss
    totalBeats: 0,
    hitBeats: 0,
    consecutiveHits: 0,
    consecutiveMisses: 0,
    shouldPulse: false,
    animateCountdown: false,

    // 结果
    hitRate: 0,
    showResultModal: false,
    isPassed: false
  },

  // 定时器
  countdownTimer: null,
  trainingTimer: null,
  beatTimer: null,

  onLoad() {
    this.startCountdown();
  },

  onUnload() {
    this.clearAllTimers();
  },

  // 开始倒计时
  startCountdown() {
    if (this.data.countdown > 0) {
      this.setData({ animateCountdown: true });
      setTimeout(() => {
        this.setData({ animateCountdown: false });
      }, 150);

      this.countdownTimer = setTimeout(() => {
        const newCountdown = this.data.countdown - 1;
        this.setData({ countdown: newCountdown });
        
        if (newCountdown > 0) {
          this.startCountdown();
        } else {
          setTimeout(() => {
            this.startTraining();
          }, 500);
        }
      }, 1000);
    }
  },

  // 开始训练
  startTraining() {
    this.setData({
      phase: 'training',
      shouldPulse: true
    });

    // 训练计时
    this.trainingTimer = setInterval(() => {
      const newTime = this.data.timeRemaining - 1;
      const progress = ((this.data.trainingDuration - newTime) / this.data.trainingDuration) * 100;
      
      this.setData({
        timeRemaining: newTime,
        progress: progress
      });

      if (newTime <= 0) {
        this.endTraining();
      }
    }, 1000);

    // 节拍脉动（模拟）
    const beatInterval = (60 / this.data.bpm) * 1000;
    this.beatTimer = setInterval(() => {
      this.setData({
        totalBeats: this.data.totalBeats + 1
      });
    }, beatInterval);
  },

  // 用户点击节拍
  handleBeatClick() {
    if (this.data.phase !== 'training') return;

    // 模拟命中判断（实际应根据时间窗口）
    const isHit = Math.random() > 0.25;
    
    if (isHit) {
      this.setData({
        orbState: 'hit',
        hitBeats: this.data.hitBeats + 1,
        consecutiveHits: this.data.consecutiveHits + 1,
        consecutiveMisses: 0
      });

      // 连续命中 ≥12 拍：收紧容忍窗
      if (this.data.consecutiveHits >= 12 && this.data.tolMs > 180) {
        this.setData({ tolMs: 180 });
      }
    } else {
      this.setData({
        orbState: 'miss',
        consecutiveMisses: this.data.consecutiveMisses + 1,
        consecutiveHits: 0
      });

      // 连续失败 ≥6 拍：放宽容忍窗
      if (this.data.consecutiveMisses >= 6 && this.data.tolMs < 220) {
        this.setData({ tolMs: 220 });
      }
    }

    // 500ms 后恢复默认状态
    setTimeout(() => {
      this.setData({ orbState: 'default' });
    }, 500);
  },

  // 暂停
  onPause() {
    this.setData({
      phase: 'paused',
      shouldPulse: false
    });
    this.clearTimers();
  },

  // 继续
  onResume() {
    this.startTraining();
  },

  // 退出
  onExit() {
    this.clearAllTimers();
    wx.navigateBack();
  },

  // 结束训练
  endTraining() {
    this.clearTimers();
    this.setData({
      phase: 'completed',
      shouldPulse: false
    });

    // 计算命中率
    const rate = this.data.totalBeats > 0 
      ? Math.round((this.data.hitBeats / this.data.totalBeats) * 100) 
      : 0;
    
    const passed = rate >= 70;

    this.setData({
      hitRate: rate,
      isPassed: passed,
      showResultModal: true
    });

    // 保存记录
    if (passed) {
      wx.setStorageSync('recentTraining', {
        hasData: true,
        hitRate: rate,
        date: this.formatDate()
      });
    }
  },

  // 解锁 Stage 2
  onUnlockStage2() {
    app.unlockStage2();
    wx.showToast({
      title: 'Stage 2 已解锁！',
      icon: 'success'
    });
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  },

  // 再试一次
  onRetry() {
    this.setData({
      phase: 'countdown',
      countdown: 3,
      timeRemaining: this.data.trainingDuration,
      progress: 0,
      totalBeats: 0,
      hitBeats: 0,
      consecutiveHits: 0,
      consecutiveMisses: 0,
      tolMs: 200,
      orbState: 'default',
      showResultModal: false
    });
    this.startCountdown();
  },

  // 返回模式选择
  onBackToMode() {
    this.clearAllTimers();
    wx.navigateBack();
  },

  // 关闭弹窗
  closeModal() {
    // 不允许点击背景关闭
  },

  // 阻止事件冒泡
  stopPropagation() {},

  // 清理定时器
  clearTimers() {
    if (this.trainingTimer) {
      clearInterval(this.trainingTimer);
      this.trainingTimer = null;
    }
    if (this.beatTimer) {
      clearInterval(this.beatTimer);
      this.beatTimer = null;
    }
  },

  clearAllTimers() {
    this.clearTimers();
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }
  },

  // 格式化日期
  formatDate() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    return `今天 ${hour}:${minute < 10 ? '0' : ''}${minute}`;
  }
});
