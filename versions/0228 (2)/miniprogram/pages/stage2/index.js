// pages/stage2/index.js
Page({
  data: {
    // DDA 参数
    bpmCur: 80,
    bpmTarget: 80,
    range: 10,
    tolMs: 200,
    
    roundDuration: 30,
    totalRounds: 4,

    // 训练状态
    phase: 'prepare', // prepare, countdown, training, paused, roundComplete, allComplete
    currentRound: 1,
    prepareCountdown: 2,
    countdown: 3,
    timeRemaining: 30,
    progress: 0,

    // 节拍状态
    orbState: 'default',
    roundHits: 0,
    roundTotal: 0,
    roundMeanErr: 0,
    shouldPulse: false,
    animateCountdown: false,

    // DDA 数据
    lastBlockAcc: 85,
    lastBlockErr: 25,
    isTransitioning: false,

    // 结果
    currentHitRate: 0,
    showRoundResult: false,
    showFinalResult: false
  },

  timer: null,

  onLoad() {
    this.startPrepare();
  },

  onUnload() {
    this.clearTimer();
  },

  // 准备阶段
  startPrepare() {
    if (this.data.prepareCountdown > 0) {
      this.timer = setTimeout(() => {
        const newCount = this.data.prepareCountdown - 1;
        this.setData({ prepareCountdown: newCount });
        
        if (newCount > 0) {
          this.startPrepare();
        } else {
          this.setData({
            phase: 'countdown',
            countdown: 3
          });
          this.startCountdown();
        }
      }, 1000);
    }
  },

  // 倒计时
  startCountdown() {
    if (this.data.countdown > 0) {
      this.setData({ animateCountdown: true });
      setTimeout(() => {
        this.setData({ animateCountdown: false });
      }, 150);

      this.timer = setTimeout(() => {
        const newCount = this.data.countdown - 1;
        this.setData({ countdown: newCount });
        
        if (newCount > 0) {
          this.startCountdown();
        } else {
          setTimeout(() => {
            this.startRound();
          }, 500);
        }
      }, 1000);
    }
  },

  // 开始一轮
  startRound() {
    this.setData({
      phase: 'training',
      shouldPulse: true,
      timeRemaining: this.data.roundDuration,
      progress: 0,
      roundHits: 0,
      roundTotal: 0
    });

    this.timer = setInterval(() => {
      const newTime = this.data.timeRemaining - 1;
      const progress = ((this.data.roundDuration - newTime) / this.data.roundDuration) * 100;
      
      this.setData({
        timeRemaining: newTime,
        progress: progress
      });

      if (newTime <= 0) {
        this.endRound();
      }
    }, 1000);
  },

  // 用户点击节拍
  handleBeatClick() {
    if (this.data.phase !== 'training') return;

    const isHit = Math.random() > 0.2;
    const newTotal = this.data.roundTotal + 1;
    const newHits = isHit ? this.data.roundHits + 1 : this.data.roundHits;
    const hitRate = Math.round((newHits / newTotal) * 100);
    
    this.setData({
      orbState: isHit ? 'hit' : 'miss',
      roundTotal: newTotal,
      roundHits: newHits,
      currentHitRate: hitRate,
      roundMeanErr: Math.round(Math.random() * 40 + 10)
    });

    setTimeout(() => {
      this.setData({ orbState: 'default' });
    }, 500);
  },

  // 结束一轮
  endRound() {
    this.clearTimer();
    this.setData({
      phase: 'roundComplete',
      shouldPulse: false,
      showRoundResult: true
    });

    // DDA 调整
    this.adjustDifficulty();
  },

  // DDA 难度调整
  adjustDifficulty() {
    const hitRate = this.data.currentHitRate;
    
    this.setData({
      lastBlockAcc: hitRate,
      lastBlockErr: this.data.roundMeanErr
    });

    if (hitRate >= 85) {
      // 提高难度
      const newTarget = Math.min(this.data.bpmCur + 10, 120);
      this.setData({
        bpmTarget: newTarget,
        range: Math.max(this.data.range - 2, 5),
        tolMs: Math.max(this.data.tolMs - 20, 120)
      });
      this.smoothTransition(this.data.bpmCur, newTarget);
    } else if (hitRate < 60) {
      // 降低难度
      const newTarget = Math.max(this.data.bpmCur - 5, 60);
      this.setData({
        bpmTarget: newTarget,
        range: Math.min(this.data.range + 2, 15),
        tolMs: Math.min(this.data.tolMs + 20, 250)
      });
      this.smoothTransition(this.data.bpmCur, newTarget);
    }
  },

  // BPM 平滑过渡
  smoothTransition(from, to) {
    if (from === to) return;
    
    this.setData({ isTransitioning: true });
    const step = (to - from) / 10;
    let current = from;
    let count = 0;

    const transitionTimer = setInterval(() => {
      count++;
      current += step;
      this.setData({ bpmCur: Math.round(current) });
      
      if (count >= 10) {
        clearInterval(transitionTimer);
        this.setData({
          bpmCur: to,
          isTransitioning: false
        });
      }
    }, 100);
  },

  // 继续下一轮
  handleNextRound() {
    this.setData({ showRoundResult: false });
    
    if (this.data.currentRound >= this.data.totalRounds) {
      this.setData({
        phase: 'allComplete',
        showFinalResult: true
      });
    } else {
      this.setData({
        currentRound: this.data.currentRound + 1,
        phase: 'prepare',
        prepareCountdown: 2
      });
      this.startPrepare();
    }
  },

  // 暂停
  onPause() {
    this.setData({
      phase: 'paused',
      shouldPulse: false
    });
    this.clearTimer();
  },

  // 继续
  onResume() {
    this.startRound();
  },

  // 退出
  onExit() {
    this.clearTimer();
    wx.navigateBack();
  },

  // 完成
  onComplete() {
    wx.navigateBack();
  },

  // 返回
  onBack() {
    this.clearTimer();
    wx.navigateBack();
  },

  // 帮助
  onHelp() {
    wx.showModal({
      title: 'Stage 2 帮助',
      content: '4 轮变速挑战，每轮 30 秒。系统会根据你的表现自动调整难度。',
      showCancel: false
    });
  },

  // 阻止事件冒泡
  stopPropagation() {},

  // 清理定时器
  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
});
