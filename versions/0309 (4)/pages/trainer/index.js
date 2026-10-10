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
    this._nowMono = createMonotonicNow();
    this._debugBeat = !!wx.getStorageSync('debugBeat');
    this._beatDebug = { intervals: [], lateness: [], lastWall: 0 };
    this._needsResyncOnShow = false;

    this._initMonkeyUI();
    this._initMetronomeSound();
  },

  setMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (this.data.isRunning) return;

    if (mode === 'stage2' && !wx.getStorageSync('stage1Passed')) {
      wx.showToast({ title: '先通过 Stage1 解锁', icon: 'none' });
      return;
    }

    this._clearAllTimers();
    this._resetStage2Runtime();

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
    }, stage2Defaults));

    this._beatQueue = [];
    this._pendingNextHit = null;
    this._setIdlePose();
    this._stopMetronome();

    if (mode === 'stage1') this._applyBpm(this.data.bpm);
  },

  onBpmChange(e) {
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
      if (passed) wx.setStorageSync('stage1Passed', true);
    } else if (this._s2) {
      const nowMono = this._nowMono ? this._nowMono() : Date.now();
      if (this._s2.phase === 'active') {
        this._s2.totalActiveAccumMs += nowMono - this._s2.totalActiveStartMono;
      }
      exportLogs = this._buildStage2BeatExport();
      logCount = exportLogs.length;
    }

    this.setData({
      isRunning: false,
      remainingSec: 0,
      hasResult: true,
      passed,
      logs: exportLogs,
      logCount,
      stage2PrepLeft: 0
    });

    if (!isManualStop) {
      wx.showToast({
        title: this.data.mode === 'stage1'
          ? (passed ? 'Stage1 达标，已解锁' : 'Stage1 未达标')
          : 'Stage2 完成',
        icon: 'none'
      });
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

    wx.setClipboardData({
      data: JSON.stringify(payload, null, 2),
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '复制失败', icon: 'none' })
    });
  },

  onReset() {
    this._clearAllTimers();
    this._resetStage2Runtime();
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
      stage2PrepLeft: 0
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
    this._timerCountDown = null;
    this._timerBeat = null;
    this._timerStage2Event = null;
  },

  onShow() {
    if (!this.data.isRunning) return;

    if (this.data.mode === 'stage1' && this._needsResyncOnShow) {
      this._needsResyncOnShow = false;
      this._resyncBeatScheduler('resume');
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
