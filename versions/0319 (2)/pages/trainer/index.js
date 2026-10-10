const subject = require('../../utils/subject');

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function mean(arr) { return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0; }
function roundTo(n, digits) {
  const p = Math.pow(10, digits || 0);
  return Math.round(n * p) / p;
}

function createMonotonicNow() {
  try {
    if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
      return () => performance.now();
    }
  } catch (e) {}
  try {
    if (typeof wx !== 'undefined' && typeof wx.getPerformance === 'function') {
      const p = wx.getPerformance();
      if (p && typeof p.now === 'function') return () => p.now();
    }
  } catch (e) {}
  return () => Date.now();
}

Page({
  data: {
    // common
    mode: 'stage1',
    tolMs: 200,
    durationSec: 60,
    isRunning: false,
    remainingSec: 60,

    // stage1
    bpm: 70,
    passAccuracy: 0.70,
    stage1BpmUnlocked: false,   // Stage1 固定 BPM 自选功能是否已解锁（复用现有 Stage1 通关解锁点）
    stage1BpmMin: 60,
    stage1BpmMax: 80,

    // stage3 家长陪同
    stage3Unlocked: false,
    stage3SelectedPhase: 1,
    stage3CurrentPhase: 1,
    stage3CurrentPhaseName: '第一阶段',
    stage3Phase1Passed: false,
    stage3Phase2Passed: false,
    stage3Phase3Completed: false,
    stage3FixedBpm: 60,
    stage3StatusText: '请选择一个阶段',
    stage3RuleText: '家长和孩子轮流完成节拍任务。',
    stage3ActiveSide: 'none',
    stage3StopBeat: false,
    stage3ParentDim: false,
    stage3ChildDim: false,
    stage3ChildAccPct: 0,
    stage3ChildCorrectCount: 0,
    stage3ScoredBeatCount: 0,
    stage3ChildTapFlash: false,
    stage3ChildTapFeedbackVisible: false,
    stage3ChildTapFeedbackText: '',
    stage3ChildTapFeedbackType: 'ack',

    // stage2
    bpmBase: 70,           // 固定绝对步长基准：整个 Stage2 永远固定为 70
    bpmCur: 70,            // 当前真实运行中的稳定 BPM（每个 block 过渡结束后更新）
    bpmTarget: 70,         // 当前 block 要平滑滑到的目标 BPM
    nextBpm: 70,           // 兼容旧 UI 字段，语义同 bpmTarget
    range: 0.05,           // 变速幅度百分比：delta = 70 * range
    delta: 3.5,            // 当前 block 的绝对步长
    acc10Pct: 0,
    meanErr10: 0,
    roundIndex: 1,
    blockIndex: 0,
    stage2PhaseText: '连续 60s 训练（不中断）',
    stage2PrepLeft: 0,
    stage2SafeMin: 50,
    stage2SafeMax: 120,

    // live BPM / metronome display
    beatIntervalMs: Math.round(60000 / 70),

    // drummer UI
    drumHitSeq: 0,
    hitSide: 'R',
    leftArmAnim: {},
    rightArmAnim: {},
    drumAnim: {},
    bodyAnim: {},

    // stats
    beatCount: 0,
    tapCount: 0,
    hitCount: 0,
    lastErrMs: 0,
    accuracyPct: 0,

    hasResult: false,
    passed: false,

    // stage1 export log + generic export count
    logs: [],
    logCount: 0
  },

  onLoad() {
    if (!subject.requireSubjectProfile()) return;
    this._nowMono = createMonotonicNow();
    this._syncStage1BpmUnlockState();
    this._syncStage3Progress();
    this._debugBeat = !!wx.getStorageSync('debugBeat');
    this._beatDebug = { intervals: [], lateness: [], lastWall: 0 };
    this._needsResyncOnShow = false;

    this._initMonkeyUI();
    this._initMetronomeSound();
  },

  _syncStage1BpmUnlockState() {
    const unlocked = !!wx.getStorageSync('stage1Passed');
    const patch = { stage1BpmUnlocked: unlocked };

    // 未解锁时，Stage1 仍维持原本默认固定节奏，不允许自由改速。
    if (!unlocked && this.data.bpm !== 70) {
      patch.bpm = 70;
      patch.beatIntervalMs = Math.round(60000 / 70);
    }

    this.setData(patch);
  },

  _syncStage3Progress() {
    const stage3Unlocked = !!wx.getStorageSync('stage1Passed');
    const stage3Phase1Passed = !!wx.getStorageSync('stage3Phase1Passed');
    const stage3Phase2Passed = !!wx.getStorageSync('stage3Phase2Passed');
    const stage3Phase3Completed = !!wx.getStorageSync('stage3Phase3Completed');

    let stage3SelectedPhase = this.data && this.data.stage3SelectedPhase ? Number(this.data.stage3SelectedPhase) : 1;
    if (stage3SelectedPhase === 3 && !stage3Phase2Passed) stage3SelectedPhase = stage3Phase1Passed ? 2 : 1;
    if (stage3SelectedPhase === 2 && !stage3Phase1Passed) stage3SelectedPhase = 1;
    if (!stage3Unlocked) stage3SelectedPhase = 1;

    this.setData({
      stage3Unlocked,
      stage3Phase1Passed,
      stage3Phase2Passed,
      stage3Phase3Completed,
      stage3SelectedPhase,
      stage3CurrentPhase: stage3SelectedPhase,
      stage3CurrentPhaseName: this._getStage3PhaseName(stage3SelectedPhase),
      stage3RuleText: this._getStage3RuleText(stage3SelectedPhase)
    });
  },

  _getStage3PhaseName(phaseId) {
    return ({ 1: '第一阶段', 2: '第二阶段', 3: '第三阶段' }[Number(phaseId)] || '第一阶段');
  },

  _getStage3RuleText(phaseId) {
    const pid = Number(phaseId);
    if (pid === 1) return '时长 60 秒：每拍换人，家长和孩子轮流点拍。';
    if (pid === 2) return '时长 60 秒：每两拍换人，同一人连续完成两拍后再换。';
    if (pid === 3) return '时长 60 秒：基本轮替继续，每 8 拍中的第 8 拍显示“停”，双方都不点。';
    return '';
  },

  _isStage3PhaseUnlocked(phaseId) {
    const pid = Number(phaseId);
    if (!this.data.stage3Unlocked) return false;
    if (pid === 1) return true;
    if (pid === 2) return !!this.data.stage3Phase1Passed;
    if (pid === 3) return !!this.data.stage3Phase2Passed;
    return false;
  },

  _getStage3LockText(phaseId) {
    const pid = Number(phaseId);
    if (pid === 1) return this.data.stage3Unlocked ? '可进入' : '需先解锁固定节奏';
    if (pid === 2) return this.data.stage3Phase1Passed ? '可进入' : '先通过第一阶段';
    if (pid === 3) return this.data.stage3Phase2Passed ? '可进入' : '先通过第二阶段';
    return '未解锁';
  },

  onSelectStage3Phase(e) {
    if (this.data.isRunning) return;
    const phaseId = Number(e.currentTarget.dataset.phase);
    if (!this._isStage3PhaseUnlocked(phaseId)) {
      wx.showToast({ title: this._getStage3LockText(phaseId), icon: 'none' });
      return;
    }

    this.setData({
      stage3SelectedPhase: phaseId,
      stage3CurrentPhase: phaseId,
      stage3CurrentPhaseName: this._getStage3PhaseName(phaseId),
      stage3RuleText: this._getStage3RuleText(phaseId),
      stage3StatusText: '准备开始'
    });
  },

  setMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (this.data.isRunning) return;

    if (mode === 'stage2' && !wx.getStorageSync('stage1Passed')) {
      wx.showToast({ title: '先完成固定节拍训练', icon: 'none' });
      return;
    }

    if (mode === 'stage3' && !wx.getStorageSync('stage1Passed')) {
      wx.showToast({ title: '先解锁固定节奏功能', icon: 'none' });
      return;
    }

    this._clearAllTimers();
    this._resetStage2Runtime();
    this._resetStage3Runtime();
    this._resetStage3Runtime();

    const durationSec = mode === 'stage2' ? 60 : 60;
    const stage2Defaults = mode === 'stage2'
      ? {
          bpmBase: 70,
          bpmCur: 70,
          bpmTarget: 70,
          nextBpm: 70,
          range: 0.05,
          delta: 3.5,
          roundIndex: 1,
          blockIndex: 0,
          acc10Pct: 0,
          meanErr10: 0,
          stage2PhaseText: '连续 60s 训练（不中断）',
          stage2PrepLeft: 0,
          stage2SafeMin: 50,
          stage2SafeMax: 120
        }
      : {};

    const stage3Progress = {
      stage3Unlocked: !!wx.getStorageSync('stage1Passed'),
      stage3Phase1Passed: !!wx.getStorageSync('stage3Phase1Passed'),
      stage3Phase2Passed: !!wx.getStorageSync('stage3Phase2Passed'),
      stage3Phase3Completed: !!wx.getStorageSync('stage3Phase3Completed')
    };
    let stage3SelectedPhase = Number(this.data.stage3SelectedPhase || 1);
    if (stage3SelectedPhase === 3 && !stage3Progress.stage3Phase2Passed) stage3SelectedPhase = stage3Progress.stage3Phase1Passed ? 2 : 1;
    if (stage3SelectedPhase === 2 && !stage3Progress.stage3Phase1Passed) stage3SelectedPhase = 1;
    if (!stage3Progress.stage3Unlocked) stage3SelectedPhase = 1;

    const stage3Defaults = mode === 'stage3'
      ? Object.assign({}, stage3Progress, {
          stage3SelectedPhase,
          stage3CurrentPhase: stage3SelectedPhase,
          stage3CurrentPhaseName: this._getStage3PhaseName(stage3SelectedPhase),
          stage3RuleText: this._getStage3RuleText(stage3SelectedPhase),
          stage3StatusText: '请选择一个阶段',
          stage3ActiveSide: 'none',
          stage3StopBeat: false,
          stage3ParentDim: false,
          stage3ChildDim: false,
          stage3ChildAccPct: 0,
          stage3ChildCorrectCount: 0,
          stage3ScoredBeatCount: 0,
          stage3ChildTapFlash: false,
          stage3ChildTapFeedbackVisible: false,
          stage3ChildTapFeedbackText: '',
          stage3ChildTapFeedbackType: 'ack',
          beatIntervalMs: Math.round(60000 / 60)
        })
      : {};

    this.setData(Object.assign({
      mode,
      durationSec,
      remainingSec: durationSec,
      isRunning: false,
      beatCount: 0,
      tapCount: 0,
      hitCount: 0,
      lastErrMs: 0,
      accuracyPct: 0,
      hasResult: false,
      passed: false,
      logs: [],
      logCount: 0,
      beatIntervalMs: Math.round(60000 / this.data.bpm)
    }, stage2Defaults, stage3Defaults));

    this._beatQueue = [];
    this._pendingNextHit = null;
    this._setIdlePose();
    this._stopMetronome();

    if (mode === 'stage1') this._applyBpm(this.data.bpm);
    if (mode === 'stage3') this._syncStage3Progress();
  },

  onBpmChange(e) {
    if (!this.data.stage1BpmUnlocked) return;
    const bpm = Number(e.detail.value);
    this.setData({ bpm });
    if (this.data.mode === 'stage1') this._applyBpm(bpm);
  },

  _applyBpm(bpm) {
    const beatIntervalMs = Math.round(60000 / bpm);
    const wasRunning = this.data.isRunning;
    this.setData({ beatIntervalMs });
    if (wasRunning && this.data.mode === 'stage1') this._resyncBeatScheduler('bpmChange');
  },

  // ========== Monkey UI ==========
  _initMonkeyUI() {
    this._setIdlePose();
    this._stopMetronome();
  },

  _setIdlePose() {
    const left = wx.createAnimation({ duration: 0, timingFunction: 'linear' });
    left.rotate(-20).translate(0, 0).step();

    const right = wx.createAnimation({ duration: 0, timingFunction: 'linear' });
    right.rotate(20).translate(0, 0).step();

    const drum = wx.createAnimation({ duration: 0, timingFunction: 'linear' });
    drum.scale(1, 1).opacity(1).step();

    const body = wx.createAnimation({ duration: 0, timingFunction: 'linear' });
    body.translate(0, 0).step();

    this.setData({
      leftArmAnim: left.export(),
      rightArmAnim: right.export(),
      drumAnim: drum.export(),
      bodyAnim: body.export()
    });
  },

  _triggerMonkeyHit() {
    const side = (this.data.hitSide === 'L') ? 'R' : 'L';
    const downDur = 90;
    const upDur = 70;

    const arm = wx.createAnimation({ timingFunction: 'ease-in-out' });
    if (side === 'L') {
      arm.rotate(-55).translate(2, 6).step({ duration: downDur });
      arm.rotate(-20).translate(0, 0).step({ duration: upDur });
    } else {
      arm.rotate(55).translate(-2, 6).step({ duration: downDur });
      arm.rotate(20).translate(0, 0).step({ duration: upDur });
    }

    const other = wx.createAnimation({ duration: 0, timingFunction: 'linear' });
    if (side === 'L') other.rotate(20).translate(0, 0).step();
    else other.rotate(-20).translate(0, 0).step();

    const drum = wx.createAnimation({ timingFunction: 'ease-out' });
    drum.scale(1.05, 0.90).opacity(1).step({ duration: downDur });
    drum.scale(1, 1).opacity(1).step({ duration: upDur });

    const body = wx.createAnimation({ timingFunction: 'ease-out' });
    body.translate(0, 1).step({ duration: downDur });
    body.translate(0, 0).step({ duration: upDur });

    const patch = {
      hitSide: side,
      drumAnim: drum.export(),
      bodyAnim: body.export()
    };
    if (side === 'L') {
      patch.leftArmAnim = arm.export();
      patch.rightArmAnim = other.export();
    } else {
      patch.rightArmAnim = arm.export();
      patch.leftArmAnim = other.export();
    }

    this.setData(patch);
  },

  // ========== Metronome ==========
  _initMetronomeSound() {
    if (this._metroPool && this._metroPool.length) return;
    try { wx.setInnerAudioOption({ obeyMuteSwitch: false }); } catch (e) {}

    const makeCtx = () => {
      const ctx = wx.createInnerAudioContext();
      ctx.src = '/assets/sounds/metronome.wav';
      ctx.autoplay = false;
      ctx.loop = false;
      ctx.volume = 0.9;
      try { ctx.obeyMuteSwitch = false; } catch (e) {}
      ctx._busyUntilWall = 0;
      try { ctx.onEnded(() => { ctx._busyUntilWall = 0; }); } catch (e) {}
      return ctx;
    };

    this._metroPool = [makeCtx(), makeCtx(), makeCtx()];
    this._metroPoolIdx = 0;
    this._metroUnlocked = false;
    this._lastMetroPlayWall = 0;
  },

  _unlockMetronomeSound() {
    if (!this._metroPool || !this._metroPool.length) this._initMetronomeSound();
    if (!this._metroPool || this._metroUnlocked) return;

    try {
      const unlockOne = (ctx) => {
        const prevVol = ctx.volume;
        ctx.volume = 0.0;
        try { ctx.stop(); } catch (e) {}
        try { ctx.seek(0); } catch (e) {}
        try { ctx.play(); } catch (e) {}
        setTimeout(() => {
          try { ctx.stop(); } catch (e) {}
          try { ctx.seek(0); } catch (e) {}
          ctx.volume = prevVol;
        }, 30);
      };
      this._metroPool.forEach(unlockOne);
      this._metroUnlocked = true;
    } catch (e) {}
  },

  _playMetronome() {
    const pool = this._metroPool;
    if (!pool || !pool.length) return;

    const nowWall = Date.now();
    if (this._lastMetroPlayWall && (nowWall - this._lastMetroPlayWall) < 15) return;
    this._lastMetroPlayWall = nowWall;

    const busyHoldMs = 140;
    let chosen = null;
    let chosenIdx = this._metroPoolIdx || 0;
    for (let i = 0; i < pool.length; i++) {
      const idx = (chosenIdx + i) % pool.length;
      const ctx = pool[idx];
      if (!ctx._busyUntilWall || nowWall >= ctx._busyUntilWall) {
        chosen = ctx;
        chosenIdx = idx;
        break;
      }
    }
    if (!chosen) chosen = pool[chosenIdx];
    this._metroPoolIdx = (chosenIdx + 1) % pool.length;
    chosen._busyUntilWall = nowWall + busyHoldMs;

    try { chosen.seek(0); } catch (e) { try { chosen.stop(); } catch (e2) {} }
    try { chosen.play(); } catch (e) {}
  },

  _stopMetronome() {
    const pool = this._metroPool;
    if (!pool || !pool.length) return;
    pool.forEach(ctx => {
      try { ctx.stop(); } catch (e) {}
      ctx._busyUntilWall = 0;
    });
  },

  _destroyMetronomeSound() {
    const pool = this._metroPool;
    if (!pool || !pool.length) return;
    pool.forEach(ctx => {
      try { ctx.stop(); } catch (e) {}
      try { ctx.destroy(); } catch (e) {}
    });
    this._metroPool = null;
    this._metroUnlocked = false;
  },

  // ========== start / stop ==========
  onStart() {
    if (this.data.isRunning) return;
    this._unlockMetronomeSound();
    if (this.data.mode === 'stage2') this._startStage2();
    else if (this.data.mode === 'stage3') this._startStage3();
    else this._startStage1();
  },

  onStop() {
    if (!this.data.isRunning) return;
    this._finishTraining(true);
  },

  _startStage1() {
    const runBpm = this.data.bpm;
    this._applyBpm(runBpm);

    const nowWall = Date.now();
    const nowMono = this._nowMono ? this._nowMono() : nowWall;

    this._beats = [];
    this._beatQueue = [];
    this._pendingNextHit = null;
    this._stage1Logs = [];

    this._startTime = nowWall;
    this._endTime = nowWall + this.data.durationSec * 1000;

    this._startWall = nowWall;
    this._startMono = nowMono;
    this._nextBeatMono = nowMono + this.data.beatIntervalMs;

    this._beatDebug = { intervals: [], lateness: [], lastWall: 0 };
    this._needsResyncOnShow = false;

    this.setData({
      isRunning: true,
      remainingSec: this.data.durationSec,
      beatCount: 0,
      tapCount: 0,
      hitCount: 0,
      lastErrMs: 0,
      accuracyPct: 0,
      hasResult: false,
      passed: false,
      logs: [],
      logCount: 0,
      stage2PhaseText: this.data.stage2PhaseText
    });

    this._setIdlePose();
    this._stopMetronome();
    this._lastDrumAnimTs = 0;

    this._timerCountDown = setInterval(() => {
      const leftMs = this._endTime - Date.now();
      const leftSec = clamp(Math.ceil(leftMs / 1000), 0, this.data.durationSec);
      this.setData({ remainingSec: leftSec });
      if (leftMs <= 0) this._finishTraining(false);
    }, 200);

    this._scheduleBeat();
  },

  _startStage2() {
    const nowWall = Date.now();
    const nowMono = this._nowMono ? this._nowMono() : nowWall;

    this._resetStage2Runtime();
    this._startWall = nowWall;
    this._startMono = nowMono;

    this._s2 = {
      bpmBase: 70,
      bpmCur: 70,
      bpmTarget: 70,
      range: 0.05,
      delta: roundTo(70 * 0.05, 2),
      safeMin: 50,
      safeMax: 120,
      beatsPerBlock: 10,
      transitionMs: 1000,
      totalActiveDurationMs: 60000,
      roundIndex: 1, // 兼容旧导出字段；连续单段 Stage2 中恒为 1
      phase: 'active',
      totalActiveAccumMs: 0,
      totalActiveStartMono: nowMono,
      beatGlobalIndex: 0,
      tapCount: 0,
      hitCount: 0,
      currentBlock: null,
      pendingBlockFinalize: null,
      lastBeatMono: null,
      nextBeatMono: null,
      pendingPreHit: null,
      beatRecords: [],
      tapLogs: [],
      blockSummaries: []
    };

    this._beatQueue = [];
    this._pendingNextHit = null;
    this._stopMetronome();
    this._lastDrumAnimTs = 0;
    this._setIdlePose();

    this.setData({
      isRunning: true,
      durationSec: 60,
      remainingSec: 60,
      beatCount: 0,
      tapCount: 0,
      hitCount: 0,
      lastErrMs: 0,
      accuracyPct: 0,
      hasResult: false,
      passed: false,
      bpmBase: 70,
      bpmCur: 70,
      bpmTarget: 70,
      nextBpm: 70,
      range: 0.05,
      delta: roundTo(70 * 0.05, 2),
      acc10Pct: 0,
      meanErr10: 0,
      roundIndex: 1,
      blockIndex: 0,
      stage2PhaseText: '连续 60s 训练中',
      stage2PrepLeft: 0,
      logs: [],
      logCount: 0,
      beatIntervalMs: Math.round(60000 / 70)
    });

    // 启动即进入单段连续训练，不再有 round / prep / 中途重启。
    this._stage2BeginBlock({
      firstBlock: true,
      anchorMono: nowMono,
      lastBeatMono: nowMono
    });
    this._stage2ScheduleEvent();
    this._timerCountDown = setInterval(() => this._stage2ClockTick(), 100);
  },

  _startStage3() {
    const phaseId = Number(this.data.stage3SelectedPhase || 1);
    if (!this._isStage3PhaseUnlocked(phaseId)) {
      wx.showToast({ title: this._getStage3LockText(phaseId), icon: 'none' });
      return;
    }

    const nowWall = Date.now();
    const nowMono = this._nowMono ? this._nowMono() : nowWall;

    this._resetStage3Runtime();
    this._startWall = nowWall;
    this._startMono = nowMono;

    this._s3 = {
      phaseId,
      phaseName: this._getStage3PhaseName(phaseId),
      bpm: 60,
      intervalMs: Math.round(60000 / 60),
      durationMs: 60000,
      phaseStartMono: nowMono,
      phaseEndMono: nowMono + 60000,
      beatIndex: 0,
      scoredBeatCount: 0,
      childCorrectCount: 0,
      childTapCount: 0,
      parentTapCount: 0,
      currentBeat: null,
      nextBeatMono: null,
      beatRecords: [],
      tapLogs: []
    };

    this._beatQueue = [];
    this._pendingNextHit = null;
    this._stopMetronome();
    this._lastDrumAnimTs = 0;
    this._setIdlePose();

    this.setData({
      isRunning: true,
      durationSec: 60,
      remainingSec: 60,
      beatCount: 0,
      tapCount: 0,
      hitCount: 0,
      lastErrMs: 0,
      accuracyPct: 0,
      hasResult: false,
      passed: false,
      logs: [],
      logCount: 0,
      beatIntervalMs: Math.round(60000 / 60),
      stage3CurrentPhase: phaseId,
      stage3CurrentPhaseName: this._getStage3PhaseName(phaseId),
      stage3RuleText: this._getStage3RuleText(phaseId),
      stage3StatusText: '训练进行中',
      stage3ActiveSide: 'none',
      stage3StopBeat: false,
      stage3ParentDim: false,
      stage3ChildDim: false,
      stage3ChildAccPct: 0,
      stage3ChildCorrectCount: 0,
      stage3ScoredBeatCount: 0,
      stage3ChildTapFlash: false,
      stage3ChildTapFeedbackVisible: false,
      stage3ChildTapFeedbackText: '',
      stage3ChildTapFeedbackType: 'ack'
    });

    this._timerCountDown = setInterval(() => this._stage3ClockTick(), 100);
    this._stage3OnBeatTick(nowMono);
  },

  _stage3ClockTick() {
    if (!this.data.isRunning || this.data.mode !== 'stage3' || !this._s3) return;
    const nowMono = this._nowMono ? this._nowMono() : Date.now();
    const leftMs = Math.max(0, this._s3.phaseEndMono - nowMono);
    const remainingSec = clamp(Math.ceil(leftMs / 1000), 0, 60);
    this.setData({ remainingSec });
    if (leftMs <= 0) this._finishTraining(false);
  },

  _resetStage3Runtime() {
    this._s3 = null;
  },

  _stage3ShiftTimeline(deltaMs) {
    if (!this._s3 || !deltaMs) return;
    this._s3.phaseStartMono += deltaMs;
    this._s3.phaseEndMono += deltaMs;
    if (typeof this._s3.nextBeatMono === 'number') this._s3.nextBeatMono += deltaMs;
    if (this._s3.currentBeat) {
      this._s3.currentBeat.beatStartMono += deltaMs;
      this._s3.currentBeat.beatEndMono += deltaMs;
    }
  },

  _resyncStage3Scheduler() {
    if (!this.data.isRunning || this.data.mode !== 'stage3' || !this._s3) return;
    clearTimeout(this._timerBeat);
    this._scheduleStage3Beat();
  },

  _stage3GetResponder(phaseId, beatIndex) {
    const pid = Number(phaseId);
    const idx = Number(beatIndex);

    if (pid === 3 && idx % 8 === 0) return 'stop';

    if (pid === 2) {
      const pair = Math.floor((idx - 1) / 2);
      return pair % 2 === 0 ? 'parent' : 'child';
    }

    return idx % 2 === 1 ? 'parent' : 'child';
  },

  _stage3ApplyPromptState(responder, beatIndex) {
    let statusText = '训练进行中';
    if (responder === 'parent') statusText = '请家长点这一下，孩子先等待';
    else if (responder === 'child') statusText = '请孩子点这一下，家长先等待';
    else statusText = '停：这一拍双方都不要点';

    this.setData({
      beatCount: beatIndex,
      stage3ActiveSide: responder,
      stage3StopBeat: responder === 'stop',
      stage3ParentDim: responder !== 'parent',
      stage3ChildDim: responder !== 'child',
      stage3StatusText: statusText
    });
  },

  _stage3ShowChildTapFeedback(type, text) {
    clearTimeout(this._stage3ChildTapFlashTimer);
    clearTimeout(this._stage3ChildTapFeedbackTimer);

    this.setData({
      stage3ChildTapFlash: true,
      stage3ChildTapFeedbackVisible: true,
      stage3ChildTapFeedbackType: type || 'ack',
      stage3ChildTapFeedbackText: text || '已收到点击'
    });

    this._stage3ChildTapFlashTimer = setTimeout(() => {
      this.setData({ stage3ChildTapFlash: false });
      this._stage3ChildTapFlashTimer = null;
    }, 180);

    this._stage3ChildTapFeedbackTimer = setTimeout(() => {
      this.setData({
        stage3ChildTapFeedbackVisible: false,
        stage3ChildTapFeedbackText: '',
        stage3ChildTapFeedbackType: 'ack'
      });
      this._stage3ChildTapFeedbackTimer = null;
    }, 480);
  },

  _stage3HandleSideInput(side, inputKind) {
    if (!this.data.isRunning || this.data.mode !== 'stage3' || !this._s3) return;

    const nowWall = Date.now();
    const nowMono = this._nowMono ? this._nowMono() : nowWall;
    const beat = this._s3.currentBeat;

    if (!beat) {
      if (side === 'child') this._stage3ShowChildTapFeedback('ack', '已收到点击');
      return;
    }

    const dedupeGap = inputKind === 'touchstart' ? 220 : 260;
    const dedupe = this._s3.lastInput;
    if (dedupe && dedupe.side === side && dedupe.beatIndex === beat.beatIndex && (nowMono - dedupe.mono) <= dedupeGap) {
      return;
    }
    this._s3.lastInput = { side, beatIndex: beat.beatIndex, mono: nowMono, kind: inputKind };

    const relMs = Math.round(nowMono - beat.beatStartMono);
    if (relMs < 0 || nowMono >= beat.beatEndMono) {
      if (side === 'child') this._stage3ShowChildTapFeedback('ack', '已收到点击');
      return;
    }

    const inWindow = relMs >= 0 && relMs <= this.data.tolMs;

    if (side === 'child') {
      this._s3.childTapCount += 1;
      beat.childTapDuringBeat = true;
      beat.childTapCount += 1;

      let feedbackType = 'ack';
      let feedbackText = '已收到点击';

      if (beat.childShouldTap && !beat.childTapInWindow && inWindow) {
        beat.childTapInWindow = true;
        beat.childErrMs = relMs;
        beat.childCorrect = true;
        feedbackType = 'hit';
        feedbackText = '点对了';
      } else if (beat.childShouldTap) {
        if (!beat.childTapInWindow) beat.childCorrect = false;
        feedbackType = 'miss';
        feedbackText = beat.childTapInWindow ? '这一拍已点过' : '这一下太晚了';
      } else {
        beat.childCorrect = false;
        feedbackType = 'miss';
        feedbackText = beat.isStop ? '停拍要忍住' : '现在轮到家长';
      }

      this._stage3ShowChildTapFeedback(feedbackType, feedbackText);
    } else {
      this._s3.parentTapCount += 1;
      beat.parentTapDuringBeat = true;
      beat.parentTapCount += 1;
      if (beat.responder === 'parent' && !beat.parentTapInWindow && inWindow) {
        beat.parentTapInWindow = true;
      }
    }

    this._s3.tapLogs.push({
      phaseId: this._s3.phaseId,
      phaseName: this._s3.phaseName,
      beatIndex: beat.beatIndex,
      responder: beat.responder,
      tapSide: side,
      tapTime: nowWall,
      relMs,
      inWindow,
      inputKind
    });

    this.setData({
      tapCount: this._s3.childTapCount + this._s3.parentTapCount,
      lastErrMs: side === 'child' ? relMs : this.data.lastErrMs
    });
  },

  _scheduleStage3Beat() {
    if (!this.data.isRunning || this.data.mode !== 'stage3' || !this._s3) return;
    clearTimeout(this._timerBeat);

    if (typeof this._s3.nextBeatMono !== 'number') return;
    const nowMono = this._nowMono ? this._nowMono() : Date.now();
    const delay = Math.max(0, this._s3.nextBeatMono - nowMono);

    this._timerBeat = setTimeout(() => {
      if (!this.data.isRunning || this.data.mode !== 'stage3' || !this._s3) return;
      this._stage3OnBeatTick(this._s3.nextBeatMono);
    }, delay);
  },

  _stage3OnBeatTick(plannedMono) {
    if (!this.data.isRunning || this.data.mode !== 'stage3' || !this._s3) return;

    const s3 = this._s3;
    const nowWall = Date.now();

    if (s3.currentBeat) this._stage3FinalizeCurrentBeat(plannedMono);

    const beatIndex = s3.beatIndex + 1;
    const responder = this._stage3GetResponder(s3.phaseId, beatIndex);
    const intervalMs = s3.intervalMs;
    const beat = {
      phaseId: s3.phaseId,
      phaseName: s3.phaseName,
      beatIndex,
      responder,
      isStop: responder === 'stop',
      childShouldTap: responder === 'child',
      beatStartMono: plannedMono,
      beatEndMono: Math.min(plannedMono + intervalMs, s3.phaseEndMono),
      targetTime: Math.round(this._monoToWall(plannedMono)),
      childTapDuringBeat: false,
      childTapInWindow: false,
      childErrMs: null,
      childTapCount: 0,
      parentTapDuringBeat: false,
      parentTapInWindow: false,
      parentTapCount: 0,
      childCorrect: null
    };

    s3.beatIndex = beatIndex;
    s3.currentBeat = beat;
    s3.nextBeatMono = plannedMono + intervalMs;

    const patch = {
      beatIntervalMs: intervalMs,
      tapCount: s3.childTapCount + s3.parentTapCount
    };

    const minGap = Math.max(180, Math.round(intervalMs * 0.6));
    if (!this._lastDrumAnimTs || (nowWall - this._lastDrumAnimTs) >= minGap) {
      this._lastDrumAnimTs = nowWall;
      patch.drumHitSeq = this.data.drumHitSeq + 1;
    }

    this.setData(patch);
    this._stage3ApplyPromptState(responder, beatIndex);
    this._playMetronome();

    if (s3.nextBeatMono < s3.phaseEndMono - 1) this._scheduleStage3Beat();
  },

  _stage3FinalizeCurrentBeat(endMono) {
    const s3 = this._s3;
    if (!s3 || !s3.currentBeat) return;

    const beat = s3.currentBeat;
    beat.beatEndMono = endMono;
    beat.childCorrect = beat.childShouldTap ? !!beat.childTapInWindow : !beat.childTapDuringBeat;

    s3.scoredBeatCount += 1;
    if (beat.childCorrect) s3.childCorrectCount += 1;

    s3.beatRecords.push({
      phaseId: beat.phaseId,
      phaseName: beat.phaseName,
      beatIndex: beat.beatIndex,
      targetTime: beat.targetTime,
      responder: beat.responder,
      isStop: beat.isStop,
      childShouldTap: beat.childShouldTap,
      childTapDuringBeat: beat.childTapDuringBeat,
      childTapInWindow: beat.childTapInWindow,
      childErrMs: beat.childErrMs,
      childCorrect: beat.childCorrect,
      childTapCount: beat.childTapCount,
      parentTapDuringBeat: beat.parentTapDuringBeat,
      parentTapInWindow: beat.parentTapInWindow,
      parentTapCount: beat.parentTapCount,
      tolMs: this.data.tolMs
    });

    const accuracyPct = s3.scoredBeatCount ? Math.round((s3.childCorrectCount / s3.scoredBeatCount) * 100) : 0;
    this.setData({
      hitCount: s3.childCorrectCount,
      accuracyPct,
      stage3ChildAccPct: accuracyPct,
      stage3ChildCorrectCount: s3.childCorrectCount,
      stage3ScoredBeatCount: s3.scoredBeatCount,
      logCount: s3.beatRecords.length
    });

    s3.currentBeat = null;
  },

  onStage3SideTouchStart(e) {
    const side = e.currentTarget.dataset.side;
    this._stage3HandleSideInput(side, 'touchstart');
  },

  onStage3SideTap(e) {
    const side = e.currentTarget.dataset.side;
    this._stage3HandleSideInput(side, 'tap');
  },

  _buildStage3BeatExport() {
    if (!this._s3 || !this._s3.beatRecords) return [];
    return this._s3.beatRecords.map(b => ({
      mode: 'stage3',
      phaseId: b.phaseId,
      phaseName: b.phaseName,
      beatIndex: b.beatIndex,
      targetTime: b.targetTime,
      responder: b.responder,
      isStop: b.isStop,
      childShouldTap: b.childShouldTap,
      childTapDuringBeat: b.childTapDuringBeat,
      childTapInWindow: b.childTapInWindow,
      childErrMs: b.childErrMs,
      childCorrect: b.childCorrect,
      childTapCount: b.childTapCount,
      parentTapDuringBeat: b.parentTapDuringBeat,
      parentTapInWindow: b.parentTapInWindow,
      parentTapCount: b.parentTapCount,
      tolMs: b.tolMs
    }));
  },

  // ========== Stage1 scheduler (unchanged) ==========
  _resyncBeatScheduler(reason) {
    if (!this.data.isRunning || this.data.mode !== 'stage1') return;

    clearTimeout(this._timerBeat);

    const nowWall = Date.now();
    const nowMono = this._nowMono ? this._nowMono() : nowWall;
    this._startWall = nowWall;
    this._startMono = nowMono;
    this._nextBeatMono = nowMono + this.data.beatIntervalMs;
    this._pendingNextHit = null;

    if (this._debugBeat) console.log(`[beat] resync reason=${reason} interval=${this.data.beatIntervalMs}ms`);
    this._scheduleBeat();
  },

  _scheduleBeat() {
    if (!this.data.isRunning || this.data.mode !== 'stage1') return;

    const interval = this.data.beatIntervalMs;
    const minLeadMs = 8;
    const nowWall = Date.now();
    const nowMono = this._nowMono ? this._nowMono() : nowWall;

    if (!this._startMono) {
      this._startWall = nowWall;
      this._startMono = nowMono;
      this._nextBeatMono = nowMono + interval;
    }

    const lateSkipMs = Math.max(120, Math.min(900, Math.round(interval * 0.75)));
    if (this._nextBeatMono <= nowMono - lateSkipMs) {
      const k = Math.floor((nowMono - this._startMono) / interval) + 1;
      this._nextBeatMono = this._startMono + k * interval;
      if (this._nextBeatMono < nowMono + minLeadMs) this._nextBeatMono += interval;
      this._pendingNextHit = null;
    }

    const delay = Math.max(0, this._nextBeatMono - nowMono);
    this._timerBeat = setTimeout(() => {
      if (!this.data.isRunning || this.data.mode !== 'stage1') return;

      const plannedMono = this._nextBeatMono;
      this._onBeatTick(plannedMono);

      const intervalNow = this.data.beatIntervalMs;
      this._nextBeatMono = plannedMono + intervalNow;

      const nowMono2 = this._nowMono ? this._nowMono() : Date.now();
      if (this._nextBeatMono < nowMono2 + minLeadMs) {
        const k2 = Math.floor((nowMono2 - this._startMono) / intervalNow) + 1;
        this._nextBeatMono = this._startMono + k2 * intervalNow;
        if (this._nextBeatMono < nowMono2 + minLeadMs) this._nextBeatMono += intervalNow;
        this._pendingNextHit = null;
      }

      if (Date.now() >= this._endTime) return;
      this._scheduleBeat();
    }, delay);
  },

  _onBeatTick(plannedMono) {
    if (!this.data.isRunning || this.data.mode !== 'stage1') return;

    const t = Date.now();
    const nowMono = this._nowMono ? this._nowMono() : t;
    const latenessMs = (typeof plannedMono === 'number') ? (nowMono - plannedMono) : 0;

    if (this._debugBeat) {
      if (!this._beatDebug) this._beatDebug = { intervals: [], lateness: [], lastWall: 0 };
      if (this._beatDebug.lastWall) {
        this._beatDebug.intervals.push(t - this._beatDebug.lastWall);
        if (this._beatDebug.intervals.length > 48) this._beatDebug.intervals.shift();
      }
      this._beatDebug.lastWall = t;
      this._beatDebug.lateness.push(latenessMs);
      if (this._beatDebug.lateness.length > 48) this._beatDebug.lateness.shift();
    }

    if (!this._beats) this._beats = [];
    this._beats.push(t);
    if (this._beats.length > 64) this._beats.shift();

    if (!this._beatQueue) this._beatQueue = [];
    const beatObj = { ts: t, hit: false };

    let hitBeats = this.data.hitCount;
    if (this._pendingNextHit && !this._pendingNextHit.used) {
      const target = this._pendingNextHit.targetTs;
      if (Math.abs(t - target) <= this.data.tolMs) {
        beatObj.hit = true;
        hitBeats += 1;
        this._pendingNextHit.used = true;
      } else if (t > target + this.data.tolMs) {
        this._pendingNextHit.used = true;
      }
    }

    this._beatQueue.push(beatObj);
    if (this._beatQueue.length > 64) this._beatQueue.shift();

    const beatCount = this.data.beatCount + 1;
    const accuracyPct = beatCount ? Math.round((hitBeats / beatCount) * 100) : 0;

    const now = t;
    const minGap = this.data.beatIntervalMs * 0.6;
    const patch = { beatCount, hitCount: hitBeats, accuracyPct };

    if (!this._lastDrumAnimTs || (now - this._lastDrumAnimTs) >= minGap) {
      this._lastDrumAnimTs = now;
      patch.drumHitSeq = this.data.drumHitSeq + 1;
    }

    this.setData(patch);
    this._playMetronome();
  },

  // ========== Stage2 core ==========
  _resetStage2Runtime() {
    this._s2 = null;
  },

  _stage2ClockTick() {
    if (!this.data.isRunning || this.data.mode !== 'stage2' || !this._s2) return;

    const nowMono = this._nowMono ? this._nowMono() : Date.now();
    const s2 = this._s2;
    if (s2.phase !== 'active') return;

    const totalActiveMs = s2.totalActiveAccumMs + (nowMono - s2.totalActiveStartMono);
    const remainingSec = clamp(Math.ceil((s2.totalActiveDurationMs - totalActiveMs) / 1000), 0, 60);

    let bpmCurDisplay = s2.bpmCur;
    if (s2.currentBlock && nowMono >= s2.currentBlock.transitionEndMono) {
      bpmCurDisplay = s2.currentBlock.bpmTarget;
      s2.bpmCur = s2.currentBlock.bpmTarget;
    }

    this.setData({
      remainingSec,
      bpmCur: roundTo(bpmCurDisplay, 2),
      stage2PhaseText: '连续 60s 训练中'
    });

    if (totalActiveMs >= s2.totalActiveDurationMs) {
      this._finishTraining(false);
    }
  },

  _stage2ShiftTimeline(deltaMs) {
    const s2 = this._s2;
    if (!s2 || !deltaMs) return;

    if (typeof s2.lastBeatMono === 'number') s2.lastBeatMono += deltaMs;
    if (typeof s2.nextBeatMono === 'number') s2.nextBeatMono += deltaMs;

    if (s2.pendingBlockFinalize) {
      s2.pendingBlockFinalize.readyMono += deltaMs;
      s2.pendingBlockFinalize.lastBeatMono += deltaMs;
      if (s2.pendingBlockFinalize.prevBlock) {
        s2.pendingBlockFinalize.prevBlock.blockAnchorMono += deltaMs;
        s2.pendingBlockFinalize.prevBlock.transitionStartMono += deltaMs;
        s2.pendingBlockFinalize.prevBlock.transitionEndMono += deltaMs;
      }
    }

    if (s2.currentBlock) {
      s2.currentBlock.blockAnchorMono += deltaMs;
      s2.currentBlock.transitionStartMono += deltaMs;
      s2.currentBlock.transitionEndMono += deltaMs;
    }
  },

  _stage2ScheduleEvent() {
    if (!this.data.isRunning || this.data.mode !== 'stage2' || !this._s2) return;
    const s2 = this._s2;
    if (s2.phase !== 'active') return;

    clearTimeout(this._timerStage2Event);

    const nowMono = this._nowMono ? this._nowMono() : Date.now();
    let eventType = null;
    let eventMono = null;

    if (s2.pendingBlockFinalize) {
      eventType = 'finalize';
      eventMono = s2.pendingBlockFinalize.readyMono;
    } else if (s2.currentBlock) {
      if (typeof s2.nextBeatMono !== 'number') {
        s2.nextBeatMono = this._stage2SolveNextBeatMono(s2.currentBlock, s2.lastBeatMono);
      }
      eventType = 'beat';
      eventMono = s2.nextBeatMono;
    }

    if (!eventType || typeof eventMono !== 'number') return;

    const delay = Math.max(0, eventMono - nowMono);
    this._timerStage2Event = setTimeout(() => {
      if (!this.data.isRunning || this.data.mode !== 'stage2' || !this._s2 || this._s2.phase !== 'active') return;
      if (eventType === 'finalize') this._stage2FinalizeBlock(eventMono);
      else this._stage2OnBeatTick(eventMono);
    }, delay);
  },

  _stage2BeginBlock(opts) {
    const s2 = this._s2;
    if (!s2) return;

    const firstBlock = !!opts.firstBlock;
    const anchorMono = opts.anchorMono;
    const lastBeatMono = opts.lastBeatMono;

    let range = s2.range;
    let acc10Pct = this.data.acc10Pct;
    let meanErr10 = this.data.meanErr10;
    let ddaAction = 'init';
    let prevStats = null;

    // 每个新 block 开始前评估上一 block（10 个系统 beat），不是按 tap 评估。
    if (!firstBlock && opts.prevBlock) {
      prevStats = this._stage2CalcBlockStats(opts.prevBlock);
      acc10Pct = Math.round(prevStats.acc10 * 100);
      meanErr10 = prevStats.meanErr;

      if (prevStats.acc10 >= 0.80 && prevStats.meanErr <= 160) {
        range = Number(clamp(roundTo(range + 0.02, 2), 0.02, 0.15).toFixed(2));
        ddaAction = 'up';
      } else if (prevStats.acc10 <= 0.60 || prevStats.meanErr >= 200) {
        range = Number(clamp(roundTo(range - 0.02, 2), 0.02, 0.15).toFixed(2));
        ddaAction = 'down';
      } else {
        range = Number(range.toFixed(2));
        ddaAction = 'hold';
      }
    }

    s2.range = range;

    // 绝对步长永远按固定基准 70 计算：delta = 70 * range
    const delta = roundTo(s2.bpmBase * range, 2);
    const bpmFrom = roundTo(s2.bpmCur, 2);
    const bpmTarget = this._stage2ChooseTargetBpm(bpmFrom, delta, s2.safeMin, s2.safeMax);

    const blockIndex = (opts.prevBlock ? opts.prevBlock.blockIndex + 1 : 1);
    const block = {
      blockIndex,
      roundIndexAtStart: s2.roundIndex,
      beatStartIndex: s2.beatGlobalIndex + 1,
      blockAnchorMono: lastBeatMono,
      transitionStartMono: anchorMono,
      transitionEndMono: anchorMono + s2.transitionMs,
      bpmFrom,
      bpmTarget,
      delta,
      range,
      ddaAction,
      beats: []
    };

    s2.currentBlock = block;
    s2.pendingBlockFinalize = null;
    s2.lastBeatMono = lastBeatMono;
    s2.nextBeatMono = this._stage2SolveNextBeatMono(block, lastBeatMono);
    s2.bpmTarget = bpmTarget;

    if (prevStats) {
      s2.blockSummaries.push({
        blockIndex: opts.prevBlock.blockIndex,
        roundIndex: opts.prevBlock.roundIndexAtStart,
        acc10: roundTo(prevStats.acc10, 4),
        meanErr: prevStats.meanErr,
        rangeAfterDDA: range,
        ddaAction
      });
    }

    this.setData({
      roundIndex: s2.roundIndex,
      blockIndex,
      range,
      delta,
      bpmTarget,
      nextBpm: bpmTarget,
      acc10Pct,
      meanErr10,
      beatIntervalMs: Math.round(60000 / Math.max(1, bpmFrom))
    });
  },

  _stage2CalcBlockStats(block) {
    const beats = block && block.beats ? block.beats.slice(0, 10) : [];
    const hitBeats = beats.filter(b => b.hit);
    const acc10 = beats.length ? hitBeats.length / beats.length : 0;
    const meanErr = hitBeats.length ? Math.round(mean(hitBeats.map(b => Math.abs(b.errMs)))) : 999;
    return { acc10, meanErr };
  },

  _stage2ChooseTargetBpm(bpmCur, delta, minBpm, maxBpm) {
    const up = roundTo(bpmCur + delta, 2);
    const down = roundTo(bpmCur - delta, 2);
    const canUp = up <= maxBpm;
    const canDown = down >= minBpm;

    if (canUp && canDown) return (Math.random() < 0.5) ? up : down;
    if (canUp) return up;
    if (canDown) return down;
    return clamp(roundTo(up, 2), minBpm, maxBpm);
  },

  // 1 秒平滑过渡：tempo(t) 在 transitionStart~transitionEnd 之间线性变化。
  _stage2TempoAt(block, tMono) {
    if (!block) return this.data.bpmCur;
    if (tMono <= block.transitionStartMono) return block.bpmFrom;
    if (tMono >= block.transitionEndMono) return block.bpmTarget;
    const p = (tMono - block.transitionStartMono) / (block.transitionEndMono - block.transitionStartMono);
    return block.bpmFrom + (block.bpmTarget - block.bpmFrom) * p;
  },

  _stage2BeatIntegral(block, aMono, bMono) {
    if (!block || bMono <= aMono) return 0;

    const s = block.transitionStartMono;
    const e = block.transitionEndMono;
    const b0 = block.bpmFrom;
    const b1 = block.bpmTarget;
    const T = Math.max(1, e - s);
    let beats = 0;

    if (aMono < s) {
      const end = Math.min(bMono, s);
      beats += (b0 * (end - aMono)) / 60000;
    }

    const x0 = Math.max(aMono, s);
    const x1 = Math.min(bMono, e);
    if (x1 > x0) {
      const k = (b1 - b0) / T;
      const dx0 = x0 - s;
      const dx1 = x1 - s;
      const area = b0 * (dx1 - dx0) + 0.5 * k * (dx1 * dx1 - dx0 * dx0);
      beats += area / 60000;
    }

    if (bMono > e) {
      const start = Math.max(aMono, e);
      beats += (b1 * (bMono - start)) / 60000;
    }

    return beats;
  },

  _stage2SolveNextBeatMono(block, lastBeatMono) {
    const minBpm = Math.min(block.bpmFrom, block.bpmTarget, this._s2 ? this._s2.safeMin : 50);
    let lo = lastBeatMono;
    let hi = lastBeatMono + Math.max(3000, Math.ceil(60000 / Math.max(1, minBpm)) * 3);

    while (this._stage2BeatIntegral(block, lastBeatMono, hi) < 1) hi += 1000;

    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      const beats = this._stage2BeatIntegral(block, lastBeatMono, mid);
      if (beats >= 1) hi = mid;
      else lo = mid;
    }
    return hi;
  },

  _stage2OnBeatTick(plannedMono) {
    if (!this.data.isRunning || this.data.mode !== 'stage2' || !this._s2 || this._s2.phase !== 'active') return;

    const nowWall = Date.now();
    const nowMono = this._nowMono ? this._nowMono() : nowWall;
    const s2 = this._s2;
    const block = s2.currentBlock;
    if (!block) return;

    const plannedWall = this._monoToWall(plannedMono);
    const bpmAtBeat = roundTo(this._stage2TempoAt(block, plannedMono), 2);

    const beatIndex = s2.beatGlobalIndex + 1;
    const beatInBlock = block.beats.length + 1;
    const beatRecord = {
      beatIndex,
      roundIndex: s2.roundIndex,
      blockIndex: block.blockIndex,
      beatInBlock,
      targetTime: Math.round(plannedWall),
      targetMono: plannedMono,
      runtimeBpm: bpmAtBeat,
      bpmFrom: block.bpmFrom,
      bpmTarget: block.bpmTarget,
      range: block.range,
      delta: block.delta,
      hit: false,
      miss: true,
      errMs: null,
      extraTapCount: 0
    };

    if (s2.pendingPreHit && !s2.pendingPreHit.used && Math.abs(s2.pendingPreHit.targetMono - plannedMono) <= 1) {
      beatRecord.hit = true;
      beatRecord.miss = false;
      beatRecord.errMs = s2.pendingPreHit.errMs;
      s2.pendingPreHit.used = true;
      s2.hitCount += 1;
    }

    s2.beatGlobalIndex = beatIndex;
    s2.lastBeatMono = plannedMono;
    block.beats.push(beatRecord);
    s2.beatRecords.push(beatRecord);
    this._beatQueue.push(beatRecord);
    if (this._beatQueue.length > 64) this._beatQueue.shift();

    const accuracyPct = beatIndex ? Math.round((s2.hitCount / beatIndex) * 100) : 0;
    const patch = {
      beatCount: beatIndex,
      hitCount: s2.hitCount,
      accuracyPct,
      blockIndex: block.blockIndex,
      logCount: s2.beatRecords.length,
      beatIntervalMs: Math.round(60000 / Math.max(1, bpmAtBeat))
    };

    const minGap = Math.max(180, Math.round((60000 / Math.max(1, bpmAtBeat)) * 0.6));
    if (!this._lastDrumAnimTs || (nowWall - this._lastDrumAnimTs) >= minGap) {
      this._lastDrumAnimTs = nowWall;
      patch.drumHitSeq = this.data.drumHitSeq + 1;
    }

    if (plannedMono >= block.transitionEndMono) {
      s2.bpmCur = block.bpmTarget;
      patch.bpmCur = roundTo(block.bpmTarget, 2);
    }

    this.setData(patch);
    this._playMetronome();

    if (this._debugBeat) {
      if (!this._beatDebug) this._beatDebug = { intervals: [], lateness: [], lastWall: 0 };
      if (this._beatDebug.lastWall) {
        this._beatDebug.intervals.push(nowWall - this._beatDebug.lastWall);
        if (this._beatDebug.intervals.length > 48) this._beatDebug.intervals.shift();
      }
      this._beatDebug.lastWall = nowWall;
      this._beatDebug.lateness.push(nowMono - plannedMono);
      if (this._beatDebug.lateness.length > 48) this._beatDebug.lateness.shift();
    }

    if (block.beats.length >= s2.beatsPerBlock) {
      s2.bpmCur = block.bpmTarget;
      s2.pendingBlockFinalize = {
        readyMono: plannedMono + this.data.tolMs,
        lastBeatMono: plannedMono,
        prevBlock: block
      };
      s2.currentBlock = null;
      s2.nextBeatMono = null;
      this.setData({ bpmCur: roundTo(s2.bpmCur, 2) });
    } else {
      s2.nextBeatMono = this._stage2SolveNextBeatMono(block, plannedMono);
    }

    this._stage2ScheduleEvent();
  },

  _stage2FinalizeBlock(readyMono) {
    if (!this.data.isRunning || this.data.mode !== 'stage2' || !this._s2 || !this._s2.pendingBlockFinalize) return;
    const pending = this._s2.pendingBlockFinalize;
    this._stage2BeginBlock({
      firstBlock: false,
      prevBlock: pending.prevBlock,
      anchorMono: readyMono,
      lastBeatMono: pending.lastBeatMono
    });
    this._stage2ScheduleEvent();
  },

  _monoToWall(monoTs) {
    if (typeof this._startMono !== 'number' || typeof this._startWall !== 'number') return Date.now();
    return this._startWall + (monoTs - this._startMono);
  },

  // ========== tap handling ==========
  onTapBeat() {
    if (!this.data.isRunning) return;
    if (this.data.mode === 'stage2') this._onTapBeatStage2();
    else this._onTapBeatStage1();
  },

  _onTapBeatStage1() {
    const tapTime = Date.now();
    const q = this._beatQueue || [];
    if (!q.length) return;

    const past = q.slice(-16);
    const interval = this.data.beatIntervalMs;
    const lastBeatObj = past[past.length - 1];
    const nextBeatFromLast = lastBeatObj.ts + interval;

    const candidates = past.map(b => ({ ts: b.ts, ref: b, kind: 'past' }));
    candidates.push({ ts: nextBeatFromLast, ref: null, kind: 'next' });

    let best = candidates[0];
    let bestAbs = Math.abs(tapTime - best.ts);
    for (let i = 1; i < candidates.length; i++) {
      const c = candidates[i];
      const abs = Math.abs(tapTime - c.ts);
      if (abs < bestAbs) {
        bestAbs = abs;
        best = c;
      }
    }

    const errMs = tapTime - best.ts;
    const absErr = Math.abs(errMs);
    const hit = absErr <= this.data.tolMs;
    const tapCount = this.data.tapCount + 1;

    let hitBeats = this.data.hitCount;
    let beatHitIncremented = false;
    if (hit) {
      if (best.kind === 'past') {
        if (best.ref && !best.ref.hit) {
          best.ref.hit = true;
          hitBeats += 1;
          beatHitIncremented = true;
        }
      } else {
        if (!this._pendingNextHit || this._pendingNextHit.used || Math.abs(this._pendingNextHit.targetTs - best.ts) > 1) {
          this._pendingNextHit = { targetTs: best.ts, used: false };
        }
      }
    }

    const accuracyPct = this.data.beatCount ? Math.round((hitBeats / this.data.beatCount) * 100) : 0;
    const logs = (this.data.logs || []).concat([{
      mode: this.data.mode,
      beatTime: best.ts,
      tapTime,
      errMs: Math.round(errMs),
      hit,
      bpm: this.data.bpm,
      tolMs: this.data.tolMs
    }]);

    const patch = {
      tapCount,
      lastErrMs: Math.round(errMs),
      logs,
      logCount: logs.length
    };

    if (beatHitIncremented) {
      patch.hitCount = hitBeats;
      patch.accuracyPct = accuracyPct;
    } else {
      patch.accuracyPct = this.data.beatCount ? Math.round((this.data.hitCount / this.data.beatCount) * 100) : 0;
    }

    this.setData(patch);
  },

  _onTapBeatStage2() {
    if (!this._s2) return;

    const tapWall = Date.now();
    const tapMono = this._nowMono ? this._nowMono() : tapWall;
    const s2 = this._s2;
    const past = (this._beatQueue || []).slice(-16);
    const candidates = past.map(b => ({ kind: 'past', beat: b, targetMono: b.targetMono }));

    if (s2.phase === 'active' && s2.currentBlock && typeof s2.nextBeatMono === 'number') {
      candidates.push({ kind: 'next', beat: null, targetMono: s2.nextBeatMono });
    }
    if (!candidates.length) return;

    let best = candidates[0];
    let bestAbs = Math.abs(tapMono - best.targetMono);
    for (let i = 1; i < candidates.length; i++) {
      const abs = Math.abs(tapMono - candidates[i].targetMono);
      if (abs < bestAbs) {
        bestAbs = abs;
        best = candidates[i];
      }
    }

    const errMs = Math.round(tapMono - best.targetMono);
    const absErr = Math.abs(errMs);
    const hit = absErr <= this.data.tolMs;
    s2.tapCount += 1;

    let extraTap = false;
    let matchedBeatIndex = null;

    if (hit) {
      if (best.kind === 'past') {
        matchedBeatIndex = best.beat.beatIndex;
        if (!best.beat.hit) {
          best.beat.hit = true;
          best.beat.miss = false;
          best.beat.errMs = errMs;
          s2.hitCount += 1;
        } else {
          best.beat.extraTapCount += 1;
          extraTap = true;
        }
      } else {
        matchedBeatIndex = s2.beatGlobalIndex + 1;
        if (!s2.pendingPreHit || s2.pendingPreHit.used || Math.abs(s2.pendingPreHit.targetMono - best.targetMono) > 1) {
          s2.pendingPreHit = {
            targetMono: best.targetMono,
            errMs,
            used: false,
            tapWall
          };
        } else {
          extraTap = true;
        }
      }
    } else {
      extraTap = true;
      if (best.kind === 'past' && best.beat) {
        matchedBeatIndex = best.beat.beatIndex;
        best.beat.extraTapCount += 1;
      }
    }

    s2.tapLogs.push({
      tapTime: tapWall,
      tapMono,
      matchedBeatIndex,
      errMs,
      hit,
      extraTap,
      mode: 'stage2'
    });

    const accuracyPct = this.data.beatCount ? Math.round((s2.hitCount / this.data.beatCount) * 100) : 0;
    this.setData({
      tapCount: s2.tapCount,
      lastErrMs: errMs,
      hitCount: s2.hitCount,
      accuracyPct
    });
  },

  // ========== finish / export / reset ==========
  _finishTraining(isManualStop) {
    if (!this.data.isRunning) return;

    this._clearAllTimers();
    this._stopMetronome();
    this._setIdlePose();

    let passed = false;
    let exportLogs = this.data.logs || [];
    let logCount = this.data.logCount || 0;

    if (this.data.mode === 'stage1') {
      const beatCount = this.data.beatCount;
      const hitBeats = this.data.hitCount;
      const acc = beatCount ? (hitBeats / beatCount) : 0;
      passed = acc >= this.data.passAccuracy;
      if (passed) {
        wx.setStorageSync('stage1Passed', true);
        this.setData({ stage1BpmUnlocked: true });
      }
      this._syncStage3Progress();
    } else if (this.data.mode === 'stage3' && this._s3) {
      const nowMono = this._nowMono ? this._nowMono() : Date.now();
      const finishMono = isManualStop ? nowMono : this._s3.phaseEndMono;
      if (this._s3.currentBeat) this._stage3FinalizeCurrentBeat(finishMono);
      exportLogs = this._buildStage3BeatExport();
      logCount = exportLogs.length;
      const acc = this._s3.scoredBeatCount ? (this._s3.childCorrectCount / this._s3.scoredBeatCount) : 0;
      passed = acc >= this.data.passAccuracy;

      if (!isManualStop) {
        if (this._s3.phaseId === 1 && passed) wx.setStorageSync('stage3Phase1Passed', true);
        if (this._s3.phaseId === 2 && passed) wx.setStorageSync('stage3Phase2Passed', true);
        if (this._s3.phaseId === 3 && passed) wx.setStorageSync('stage3Phase3Completed', true);
      }
      this._syncStage3Progress();
    } else if (this._s2) {
      const nowMono = this._nowMono ? this._nowMono() : Date.now();
      if (this._s2.phase === 'active') {
        this._s2.totalActiveAccumMs += nowMono - this._s2.totalActiveStartMono;
      }
      exportLogs = this._buildStage2BeatExport();
      logCount = exportLogs.length;
    }

    wx.setStorageSync('recentTraining', {
      hasData: true,
      hitRate: this.data.beatCount ? Math.round((this.data.hitCount / this.data.beatCount) * 100) : 0,
      date: subject.formatRecentLabel(Date.now()),
      savedAt: Date.now(),
      mode: this.data.mode,
      subject: subject.getSubjectMeta()
    });

    this.setData({
      isRunning: false,
      remainingSec: 0,
      hasResult: true,
      passed,
      logs: exportLogs,
      logCount,
      stage2PrepLeft: 0,
      stage1BpmUnlocked: !!wx.getStorageSync('stage1Passed'),
      stage3Unlocked: !!wx.getStorageSync('stage1Passed'),
      stage3Phase1Passed: !!wx.getStorageSync('stage3Phase1Passed'),
      stage3Phase2Passed: !!wx.getStorageSync('stage3Phase2Passed'),
      stage3Phase3Completed: !!wx.getStorageSync('stage3Phase3Completed'),
      stage3ChildTapFlash: false,
      stage3ChildTapFeedbackVisible: false,
      stage3ChildTapFeedbackText: '',
      stage3ChildTapFeedbackType: 'ack'
    });

    if (!isManualStop) {
      let finishTitle = '训练完成';
      if (this.data.mode === 'stage1') finishTitle = passed ? '固定节拍达标，已解锁' : '固定节拍未达标';
      else if (this.data.mode === 'stage2') finishTitle = '变速训练完成';
      else if (this.data.mode === 'stage3') finishTitle = passed ? (this._getStage3PhaseName(this.data.stage3CurrentPhase) + '已通过') : (this._getStage3PhaseName(this.data.stage3CurrentPhase) + '未通过');
      wx.showToast({ title: finishTitle, icon: 'none' });
    }
  },

  _buildStage2BeatExport() {
    if (!this._s2 || !this._s2.beatRecords) return [];
    return this._s2.beatRecords.map(b => ({
      mode: 'stage2',
      beatIndex: b.beatIndex,
      roundIndex: b.roundIndex,
      blockIndex: b.blockIndex,
      beatInBlock: b.beatInBlock,
      beatTime: b.targetTime,
      bpm: b.runtimeBpm,
      bpmCurStart: b.bpmFrom,
      bpmTarget: b.bpmTarget,
      range: b.range,
      delta: b.delta,
      hit: b.hit,
      miss: b.miss,
      errMs: b.errMs,
      extraTapCount: b.extraTapCount,
      tolMs: this.data.tolMs
    }));
  },

  onExport() {
    const payload = this.data.mode === 'stage2'
      ? {
          meta: {
            mode: 'stage2',
            tolMs: this.data.tolMs,
            durationSec: 60,
            bpm_base: this.data.bpmBase,
            bpmCur: this.data.bpmCur,
            bpmTarget: this.data.bpmTarget,
            range: this.data.range,
            delta: this.data.delta,
            safeMin: this.data.stage2SafeMin,
            safeMax: this.data.stage2SafeMax,
            structure: 'single_continuous_60s_stage',
            beatsPerBlock: 10,
            beatCount: this.data.beatCount,
            tapCount: this.data.tapCount,
            hitCount: this.data.hitCount,
            accuracy: this.data.beatCount ? (this.data.hitCount / this.data.beatCount) : 0
          },
          blocks: this._s2 ? this._s2.blockSummaries : [],
          logs: this._buildStage2BeatExport(),
          tapLogs: this._s2 ? this._s2.tapLogs : []
        }
      : this.data.mode === 'stage3'
      ? {
          meta: {
            mode: 'stage3',
            phaseId: this.data.stage3CurrentPhase,
            phaseName: this.data.stage3CurrentPhaseName,
            tolMs: this.data.tolMs,
            durationSec: 60,
            bpm_stage3: this.data.stage3FixedBpm,
            passAccuracy: this.data.passAccuracy,
            scoredBeatCount: this.data.stage3ScoredBeatCount,
            childCorrectCount: this.data.stage3ChildCorrectCount,
            childAccuracy: this.data.stage3ScoredBeatCount ? (this.data.stage3ChildCorrectCount / this.data.stage3ScoredBeatCount) : 0
          },
          logs: this._buildStage3BeatExport(),
          tapLogs: this._s3 ? this._s3.tapLogs : []
        }
      : {
          meta: {
            mode: this.data.mode,
            tolMs: this.data.tolMs,
            durationSec: this.data.durationSec,
            bpm_stage1: this.data.bpm,
            passAccuracy: this.data.passAccuracy,
            beatCount: this.data.beatCount,
            tapCount: this.data.tapCount,
            hitCount: this.data.hitCount,
            accuracy: this.data.beatCount ? (this.data.hitCount / this.data.beatCount) : 0
          },
          logs: this.data.logs || []
        };

    subject.attachSubjectMeta(payload);

    wx.setClipboardData({
      data: JSON.stringify(payload, null, 2),
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '复制失败', icon: 'none' })
    });
  },

  onReset() {
    this._clearAllTimers();
    this._resetStage2Runtime();
    this._resetStage3Runtime();
    const durationSec = this.data.mode === 'stage2' ? 60 : 60;
    this.setData({
      beatCount: 0,
      tapCount: 0,
      hitCount: 0,
      lastErrMs: 0,
      accuracyPct: 0,
      hasResult: false,
      passed: false,
      logs: [],
      logCount: 0,
      remainingSec: durationSec,
      roundIndex: 1,
      blockIndex: 0,
      acc10Pct: 0,
      meanErr10: 0,
      bpmBase: 70,
      bpmCur: 70,
      bpmTarget: 70,
      nextBpm: 70,
      range: 0.05,
      delta: 3.5,
      stage2PhaseText: this.data.mode === 'stage2' ? '连续 60s 训练（不中断）' : '未开始',
      stage2PrepLeft: 0,
      stage1BpmUnlocked: !!wx.getStorageSync('stage1Passed'),
      stage3Unlocked: !!wx.getStorageSync('stage1Passed'),
      stage3Phase1Passed: !!wx.getStorageSync('stage3Phase1Passed'),
      stage3Phase2Passed: !!wx.getStorageSync('stage3Phase2Passed'),
      stage3Phase3Completed: !!wx.getStorageSync('stage3Phase3Completed'),
      stage3CurrentPhase: Number(this.data.stage3SelectedPhase || 1),
      stage3CurrentPhaseName: this._getStage3PhaseName(this.data.stage3SelectedPhase || 1),
      stage3RuleText: this._getStage3RuleText(this.data.stage3SelectedPhase || 1),
      stage3StatusText: '请选择一个阶段',
      stage3ActiveSide: 'none',
      stage3StopBeat: false,
      stage3ParentDim: false,
      stage3ChildDim: false,
      stage3ChildAccPct: 0,
      stage3ChildCorrectCount: 0,
      stage3ScoredBeatCount: 0,
      stage3ChildTapFlash: false,
      stage3ChildTapFeedbackVisible: false,
      stage3ChildTapFeedbackText: '',
      stage3ChildTapFeedbackType: 'ack'
    });

    this._beatQueue = [];
    this._pendingNextHit = null;
    this._setIdlePose();
    this._stopMetronome();
  },

  _clearAllTimers() {
    clearInterval(this._timerCountDown);
    clearTimeout(this._timerBeat);
    clearTimeout(this._timerStage2Event);
    clearTimeout(this._stage3ChildTapFlashTimer);
    clearTimeout(this._stage3ChildTapFeedbackTimer);
    this._timerCountDown = null;
    this._timerBeat = null;
    this._timerStage2Event = null;
    this._stage3ChildTapFlashTimer = null;
    this._stage3ChildTapFeedbackTimer = null;
  },

  onShow() {
    if (!this.data.isRunning) return;

    if (this.data.mode === 'stage1' && this._needsResyncOnShow) {
      this._needsResyncOnShow = false;
      this._resyncBeatScheduler('resume');
      return;
    }

    if (this.data.mode === 'stage3' && this._needsResyncOnShow && this._hiddenAtMono) {
      this._needsResyncOnShow = false;
      const nowMono = this._nowMono ? this._nowMono() : Date.now();
      const hiddenDelta = Math.max(0, nowMono - this._hiddenAtMono);
      this._stage3ShiftTimeline(hiddenDelta);
      this._resyncStage3Scheduler();
      if (!this._timerCountDown) this._timerCountDown = setInterval(() => this._stage3ClockTick(), 100);
      return;
    }

    if (this.data.mode === 'stage2' && this._needsResyncOnShow && this._hiddenAtMono) {
      this._needsResyncOnShow = false;
      const nowMono = this._nowMono ? this._nowMono() : Date.now();
      const hiddenDelta = Math.max(0, nowMono - this._hiddenAtMono);
      if (this._s2) {
        if (this._s2.phase === 'active') {
          if (this._s2.totalActiveStartMono) this._s2.totalActiveStartMono += hiddenDelta;
          this._stage2ShiftTimeline(hiddenDelta);
          this._stage2ScheduleEvent();
        }
      }
      if (!this._timerCountDown) this._timerCountDown = setInterval(() => this._stage2ClockTick(), 100);
    }
  },

  onHide() {
    this._stopMetronome();

    if (this.data.isRunning) {
      clearTimeout(this._timerBeat);
      clearTimeout(this._timerStage2Event);
      this._timerBeat = null;
      this._timerStage2Event = null;
      this._needsResyncOnShow = true;
      this._hiddenAtMono = this._nowMono ? this._nowMono() : Date.now();
    }
  },

  onUnload() {
    this._clearAllTimers();
    this._destroyMetronomeSound();
  }
});
