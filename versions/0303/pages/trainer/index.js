function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function mean(arr) { return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0; }
function randInt(a, b) {
  const lo = Math.ceil(Math.min(a, b));
  const hi = Math.floor(Math.max(a, b));
  return Math.floor(lo + Math.random() * (hi - lo + 1));
}


function createMonotonicNow() {
  // Prefer a monotonic clock for scheduling to avoid Date.now jumps and reduce drift.
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
  // Fallback (not monotonic, but always available)
  return () => Date.now();
}


Page({
  data: {
    // common
    mode: "stage1",          // "stage1" | "stage2"
    tolMs: 200,              // 统一容忍窗 200ms
    durationSec: 60,         // 每轮时长（stage1默认60s；stage2可改）
    isRunning: false,
    remainingSec: 60,

    // stage1
    bpm: 70,
    passAccuracy: 0.70,

    // stage2 (DDA)
    bpmCur: 70,              // 当前能力中心
    range: 10,               // 难度范围（越小越难）
    nextBpm: 70,
    acc10Pct: 0,
    meanErr10: 0,

    // metronome
    beatIntervalMs: Math.round(60000 / 70),

    // drummer UI (UI only)
    drumHitSeq: 0,

    // monkey animation (UI only)
    hitSide: 'R', // first beat => L
    leftArmAnim: {},
    rightArmAnim: {},
    drumAnim: {},
    bodyAnim: {},

    // stats
    beatCount: 0, // 系统产生的拍数（tick 次数）
    tapCount: 0,
    hitCount: 0,
    lastErrMs: 0,
    accuracyPct: 0,

    hasResult: false,
    passed: false,

    // logs
    logs: []
  },

  onLoad() {
    const stage1Passed = !!wx.getStorageSync("stage1Passed");
    if (stage1Passed) {
      // 允许直接切Stage2（不强制）
    }

// monotonic clock for stable beat scheduling
this._nowMono = createMonotonicNow();
// toggle with: wx.setStorageSync('debugBeat', true/false) then reload page
this._debugBeat = !!wx.getStorageSync('debugBeat');
this._beatDebug = { intervals: [], lateness: [], lastWall: 0 };
this._needsResyncOnShow = false;

    // init monkey idle pose (UI only)
    this._initMonkeyUI();

    // init metronome click sound (UI only)
    this._initMetronomeSound();
  },

  setMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (this.data.isRunning) return;

    if (mode === "stage2" && !wx.getStorageSync("stage1Passed")) {
      wx.showToast({ title: "先通过 Stage1 解锁", icon: "none" });
      return;
    }

    this.setData({
      mode,
      hasResult: false,
      beatCount: 0,
      tapCount: 0,
      hitCount: 0,
      lastErrMs: 0,
      accuracyPct: 0,
      logs: []
    });

    // reset beat-based scoring queue
    this._beatQueue = [];
    this._pendingNextHit = null;

    this._setIdlePose();

    this._stopMetronome();

    if (mode === "stage2") {
      const nextBpm = this._pickNextBpm(this.data.bpmCur, this.data.range);
      this.setData({ nextBpm });
    } else {
      this._applyBpm(this.data.bpm);
    }
  },

  onBpmChange(e) {
    const bpm = Number(e.detail.value);
    this.setData({ bpm });
    if (this.data.mode === "stage1") this._applyBpm(bpm);
  },
_applyBpm(bpm) {
  const beatIntervalMs = Math.round(60000 / bpm);
  const wasRunning = this.data.isRunning;
  this.setData({ beatIntervalMs });

  // If BPM changes during a run (future-proof for Stage2), re-align scheduler
  // so we don't "catch up" with burst ticks.
  if (wasRunning) this._resyncBeatScheduler('bpmChange');
},



  // ========== Monkey UI (UI only; driven by real beat tick) ==========
  _initMonkeyUI() {
    // Set a stable idle pose so arms don't jump when first animating
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
    // First beat should be Left: initial hitSide is 'R', then toggle to 'L'
    const side = (this.data.hitSide === 'L') ? 'R' : 'L';

    const downDur = 90;
    const upDur = 70;

    // Arm animation (single hit: down -> back to idle)
    const arm = wx.createAnimation({ timingFunction: 'ease-in-out' });
    if (side === 'L') {
      arm.rotate(-55).translate(2, 6).step({ duration: downDur });
      arm.rotate(-20).translate(0, 0).step({ duration: upDur });
    } else {
      arm.rotate(55).translate(-2, 6).step({ duration: downDur });
      arm.rotate(20).translate(0, 0).step({ duration: upDur });
    }

    // Keep the other arm strictly idle (no motion this beat)
    const other = wx.createAnimation({ duration: 0, timingFunction: 'linear' });
    if (side === 'L') other.rotate(20).translate(0, 0).step();
    else other.rotate(-20).translate(0, 0).step();

    // Drum: only squish once with the hit, then return (no second flash)
    const drum = wx.createAnimation({ timingFunction: 'ease-out' });
    drum.scale(1.05, 0.90).opacity(1).step({ duration: downDur });
    drum.scale(1, 1).opacity(1).step({ duration: upDur });

    // Body: tiny bounce with the hit
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

  // ========== Metronome click sound (UI only; driven by real beat tick) ==========
_initMetronomeSound() {
  if (this._metroPool && this._metroPool.length) return;
  try {
    // allow click even when system mute is on (optional)
    wx.setInnerAudioOption({ obeyMuteSwitch: false });
  } catch (e) {}

  const makeCtx = () => {
    const ctx = wx.createInnerAudioContext();
    // Use absolute path from project root for stability
    ctx.src = '/assets/sounds/metronome.wav';
    ctx.autoplay = false;
    ctx.loop = false;
    ctx.volume = 0.9;
    try { ctx.obeyMuteSwitch = false; } catch (e) {}

    // Rough "busy" window to avoid reusing the same ctx while it may still be playing.
    // (metronome.wav is a short click; this just guards against rapid re-trigger.)
    ctx._busyUntilWall = 0;
    try {
      ctx.onEnded(() => { ctx._busyUntilWall = 0; });
    } catch (e) {}
    return ctx;
  };

  // Small pool: avoids stop/seek jitter on a single context and tolerates occasional close triggers.
  this._metroPool = [makeCtx(), makeCtx(), makeCtx()];
  this._metroPoolIdx = 0;

  this._metroUnlocked = false;
  this._lastMetroPlayWall = 0;
},

_unlockMetronomeSound() {
  // Must be called from a user gesture (e.g., Start button) to satisfy iOS autoplay policy
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

    // Unlock all contexts within the same user-gesture window.
    this._metroPool.forEach(unlockOne);
    this._metroUnlocked = true;
  } catch (e) {
    // ignore
  }
},

_playMetronome() {
  const pool = this._metroPool;
  if (!pool || !pool.length) return;

  const nowWall = Date.now();

  // Safety guard: if a bug causes double-call within a few ms, ignore the duplicate.
  if (this._lastMetroPlayWall && (nowWall - this._lastMetroPlayWall) < 15) return;
  this._lastMetroPlayWall = nowWall;

  const busyHoldMs = 140;

  // Pick an available context (round-robin, skip busy ones)
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
  if (!chosen) {
    chosen = pool[chosenIdx];
  }
  this._metroPoolIdx = (chosenIdx + 1) % pool.length;
  chosen._busyUntilWall = nowWall + busyHoldMs;

  // Prefer seek(0) without stop (less startup jitter); fallback to stop+play if seek unsupported.
  try {
    chosen.seek(0);
  } catch (e) {
    try { chosen.stop(); } catch (e2) {}
  }
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



  onStart() {
    if (this.data.isRunning) return;

    // unlock metronome audio (user gesture)
    this._unlockMetronomeSound();

    // stage2：每轮使用 nextBpm 作为本轮 bpm
    let runBpm = this.data.bpm;
    if (this.data.mode === "stage2") {
      runBpm = this.data.nextBpm;
      this._applyBpm(runBpm);
    } else {
      this._applyBpm(this.data.bpm);
    }

    const nowWall = Date.now();
const nowMono = this._nowMono ? this._nowMono() : nowWall;

this._beats = [];
// beat-based scoring queue: each tick adds { ts, hit }
this._beatQueue = [];
// early-tap pre-hit for the next beat (UI-only accounting)
this._pendingNextHit = null;

// wall clock bounds (kept for existing countdown/end condition)
this._startTime = nowWall;
this._endTime = nowWall + this.data.durationSec * 1000;

// monotonic scheduling baseline (stable against drift/catch-up)
this._startWall = nowWall;
this._startMono = nowMono;
this._nextBeatMono = nowMono + this.data.beatIntervalMs;

// debug stats reset (toggle with wx.setStorageSync('debugBeat', true/false))
this._beatDebug = { intervals: [], lateness: [], lastWall: 0 };
this._needsResyncOnShow = false;


    // Stage2：用于计算 acc10 / mean_err 的窗口
    this._last10 = []; // {hit, absErr}

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
      logs: []
    });

    this._setIdlePose();

    this._stopMetronome();
    this._lastDrumAnimTs = 0;

    this._timerCountDown = setInterval(() => {
      const leftMs = this._endTime - Date.now();
      const leftSec = clamp(Math.ceil(leftMs / 1000), 0, this.data.durationSec);
      this.setData({ remainingSec: leftSec });
      if (leftMs <= 0) this._finishRound(false, runBpm);
    }, 200);

    this._scheduleBeat();
  },

  onStop() {
    if (!this.data.isRunning) return;
    const runBpm = (this.data.mode === "stage2") ? this.data.nextBpm : this.data.bpm;
    this._finishRound(true, runBpm);
  },
_resyncBeatScheduler(reason) {
  if (!this.data.isRunning) return;

  clearTimeout(this._timerBeat);

  const nowWall = Date.now();
  const nowMono = this._nowMono ? this._nowMono() : nowWall;

  // Rebase scheduling grid to "now" to avoid burst catch-up after stalls / background resume.
  this._startWall = nowWall;
  this._startMono = nowMono;
  this._nextBeatMono = nowMono + this.data.beatIntervalMs;

  // Pending "next beat" pre-hit becomes invalid after resync.
  this._pendingNextHit = null;

  if (this._debugBeat) {
    console.log(`[beat] resync reason=${reason} interval=${this.data.beatIntervalMs}ms`);
  }

  this._scheduleBeat();
},

_scheduleBeat() {
  if (!this.data.isRunning) return;

  const interval = this.data.beatIntervalMs;
  const minLeadMs = 8;

  const nowWall = Date.now();
  const nowMono = this._nowMono ? this._nowMono() : nowWall;

  if (!this._startMono) {
    this._startWall = nowWall;
    this._startMono = nowMono;
    this._nextBeatMono = nowMono + interval;
  }

  // If we are too far behind (stall/background), do NOT burst-catch-up.
  const lateSkipMs = Math.max(120, Math.min(900, Math.round(interval * 0.75)));
  if (this._nextBeatMono <= nowMono - lateSkipMs) {
    const lateness = nowMono - this._nextBeatMono;

    // Align to the next grid point after "now"
    const k = Math.floor((nowMono - this._startMono) / interval) + 1;
    this._nextBeatMono = this._startMono + k * interval;
    if (this._nextBeatMono < nowMono + minLeadMs) this._nextBeatMono += interval;

    // Pending next-hit no longer meaningful after a stall.
    this._pendingNextHit = null;

    if (this._debugBeat) {
      console.log(`[beat] skipCatchUp lateness=${Math.round(lateness)}ms -> nextIn=${Math.round(this._nextBeatMono - nowMono)}ms`);
    }
  }

  const delay = Math.max(0, this._nextBeatMono - nowMono);
  this._timerBeat = setTimeout(() => {
    if (!this.data.isRunning) return;

    const plannedMono = this._nextBeatMono;
    this._onBeatTick(plannedMono);

    // Advance by exactly one interval on the scheduling grid.
    const intervalNow = this.data.beatIntervalMs;
    this._nextBeatMono = plannedMono + intervalNow;

    // Ensure next beat is in the future; if we're behind, jump forward to the next grid point.
    const nowMono2 = this._nowMono ? this._nowMono() : Date.now();
    if (this._nextBeatMono < nowMono2 + minLeadMs) {
      const k2 = Math.floor((nowMono2 - this._startMono) / intervalNow) + 1;
      this._nextBeatMono = this._startMono + k2 * intervalNow;
      if (this._nextBeatMono < nowMono2 + minLeadMs) this._nextBeatMono += intervalNow;

      this._pendingNextHit = null;
      if (this._debugBeat) console.log('[beat] lateAdvance -> realign');
    }

    if (Date.now() >= this._endTime) return;
    this._scheduleBeat();
  }, delay);
  },

  _onBeatTick(plannedMono) {
  if (!this.data.isRunning) return;

  // Real wall-clock tick time (used for logs / scoring to match what the user perceives)
  const t = Date.now();

  // Monotonic clock for scheduling diagnostics (how late/early this tick fired)
  const nowMono = this._nowMono ? this._nowMono() : t;
  const latenessMs = (typeof plannedMono === 'number') ? (nowMono - plannedMono) : 0;

  // Debug interval stats (toggle with wx.setStorageSync('debugBeat', true/false) then reload)
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

  this._beats.push(t);
  // 长度控制：仅保留最近一段时间的 beats，避免无限增长
  if (this._beats.length > 64) this._beats.shift();

  // ===== Beat-based scoring (漏点计为 miss) =====
  if (!this._beatQueue) this._beatQueue = [];
  const beatObj = { ts: t, hit: false };

  // 如果用户在下一拍到来前提前命中（pre-hit），在真正 tick 到来时兑现为命中
  let hitBeats = this.data.hitCount;
  if (this._pendingNextHit && !this._pendingNextHit.used) {
    const target = this._pendingNextHit.targetTs;
    if (Math.abs(t - target) <= this.data.tolMs) {
      beatObj.hit = true;
      hitBeats += 1;
      this._pendingNextHit.used = true;
    } else if (t > target + this.data.tolMs) {
      // 过期（错过窗口），避免一直挂着影响后续
      this._pendingNextHit.used = true;
    }
  }

  this._beatQueue.push(beatObj);
  if (this._beatQueue.length > 64) this._beatQueue.shift();

  const beatCount = this.data.beatCount + 1;
  const accuracyPct = beatCount ? Math.round((hitBeats / beatCount) * 100) : 0;

  // Drummer hit (UI only) - strictly one hit per real beat tick
  // 仅做 UI 层去重：不影响 beat 记录与训练统计
  const now = t;
  const minGap = this.data.beatIntervalMs * 0.6;
  const patch = {
    beatCount,
    hitCount: hitBeats,
    accuracyPct
  };

  if (!this._lastDrumAnimTs || (now - this._lastDrumAnimTs) >= minGap) {
    this._lastDrumAnimTs = now;
    patch.drumHitSeq = this.data.drumHitSeq + 1;
  }

  this.setData(patch);

  // Metronome click: strictly one click per real beat tick
  this._playMetronome();

  // Periodic debug print (every 8 beats): interval + lateness (scheduler jitter proxy)
  if (this._debugBeat && (beatCount % 8 === 0) && this._beatDebug && this._beatDebug.intervals.length) {
    const xs = this._beatDebug.intervals.slice(-16);
    const minI = Math.min.apply(null, xs);
    const maxI = Math.max.apply(null, xs);
    const meanI = Math.round(mean(xs));
    const jitterI = maxI - minI;

    const ls = this._beatDebug.lateness.slice(-16);
    const minL = Math.round(Math.min.apply(null, ls));
    const maxL = Math.round(Math.max.apply(null, ls));
    const meanL = Math.round(mean(ls));

    console.log(`[beat] count=${beatCount} interval(ms) mean=${meanI} min=${minI} max=${maxI} jitter=${jitterI} | lateness(ms) mean=${meanL} min=${minL} max=${maxL}`);
  }
  },

  onTapBeat() {
    if (!this.data.isRunning) return;

    const tapTime = Date.now();
    const q = this._beatQueue || [];
    if (!q.length) return;

    // 最近 beat 候选：过去若干拍 + 额外加入下一拍（未来）候选，避免提前点被错误匹配到上一拍
    const past = q.slice(-16);
    const interval = this.data.beatIntervalMs;
    const lastBeatObj = past[past.length - 1];
    const nextBeatFromLast = lastBeatObj.ts + interval;

    const candidates = past.map(b => ({ ts: b.ts, ref: b, kind: 'past' }));
    candidates.push({ ts: nextBeatFromLast, ref: null, kind: 'next' });

    // 在候选集合里找绝对误差最小的 beat
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

    // ===== Beat-based scoring: 一拍只能算一次命中 =====
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
        // 命中“下一拍”：记录预命中，等待真正 tick 到来时兑现
        if (!this._pendingNextHit || this._pendingNextHit.used || Math.abs(this._pendingNextHit.targetTs - best.ts) > 1) {
          this._pendingNextHit = { targetTs: best.ts, used: false };
        }
      }
    }

    const accuracyPct = this.data.beatCount ? Math.round((hitBeats / this.data.beatCount) * 100) : 0;

    // Stage2：更新 last10 窗口
    if (this.data.mode === "stage2") {
      this._last10.push({ hit, absErr });
      if (this._last10.length > 10) this._last10.shift();

      const acc10 = this._last10.length ? this._last10.filter(x => x.hit).length / this._last10.length : 0;
      const meanErr10 = Math.round(mean(this._last10.map(x => x.absErr)));

      this.setData({
        acc10Pct: Math.round(acc10 * 100),
        meanErr10
      });

      // 每 10 次点击触发一次 DDA 更新
      if (tapCount % 10 === 0) {
        this._updateDDA(acc10, meanErr10);
      }
    }

    const logs = this.data.logs.concat([{
      mode: this.data.mode,
      beatTime: best.ts,
      tapTime,
      errMs: Math.round(errMs),
      hit,
      bpm: (this.data.mode === "stage2") ? this.data.nextBpm : this.data.bpm,
      tolMs: this.data.tolMs,
      bpmCur: this.data.bpmCur,
      range: this.data.range,
      acc10: this.data.acc10Pct / 100,
      meanErr10: this.data.meanErr10
    }]);

    const patch = {
      tapCount,
      lastErrMs: Math.round(errMs),
      logs
    };

    if (beatHitIncremented) {
      patch.hitCount = hitBeats;
      patch.accuracyPct = accuracyPct;
    } else {
      // accuracyPct 可能因 beatCount 增长在 tick 中更新；这里保持一致即可
      patch.accuracyPct = this.data.beatCount ? Math.round((this.data.hitCount / this.data.beatCount) * 100) : 0;
    }

    this.setData(patch);
  },

  _updateDDA(acc10, meanErr10) {
    // 结构匹配：acc10、mean_err、range、bpm_cur
    // 可跑且稳定的阈值（后续你可以调参）
    let bpmCur = this.data.bpmCur;
    let range = this.data.range;

    if (acc10 >= 0.8 && meanErr10 <= 60) {
      range = clamp(range - 2, 4, 20);
      bpmCur = clamp(bpmCur + 2, 50, 120);
    } else if (acc10 < 0.6 || meanErr10 > 120) {
      range = clamp(range + 2, 4, 20);
      bpmCur = clamp(bpmCur - 2, 50, 120);
    }

    const nextBpm = this._pickNextBpm(bpmCur, range);

    this.setData({
      bpmCur,
      range,
      nextBpm
    });
  },

  _pickNextBpm(bpmCur, range) {
    const half = Math.max(1, Math.floor(range / 2));
    const lo = clamp(bpmCur - half, 50, 120);
    const hi = clamp(bpmCur + half, 50, 120);
    return randInt(lo, hi);
  },

  _finishRound(isManualStop, runBpm) {
    if (!this.data.isRunning) return;

    clearInterval(this._timerCountDown);
    clearTimeout(this._timerBeat);
    const beatCount = this.data.beatCount;
    const hitBeats = this.data.hitCount;
    const acc = beatCount ? (hitBeats / beatCount) : 0;

    // Stage1 判定解锁
    let passed = false;
    if (this.data.mode === "stage1") {
      passed = acc >= this.data.passAccuracy;
      if (passed) wx.setStorageSync("stage1Passed", true);
    }

    this.setData({
      isRunning: false,
      remainingSec: 0,
      hasResult: true,
      passed
    });

    this._setIdlePose();

    this._stopMetronome();

if (this._debugBeat && this._beatDebug && this._beatDebug.intervals && this._beatDebug.intervals.length) {
  const xs = this._beatDebug.intervals.slice(-32);
  const minI = Math.min.apply(null, xs);
  const maxI = Math.max.apply(null, xs);
  const meanI = Math.round(mean(xs));
  const jitterI = maxI - minI;

  const ls = (this._beatDebug.lateness || []).slice(-32);
  const minL = ls.length ? Math.round(Math.min.apply(null, ls)) : 0;
  const maxL = ls.length ? Math.round(Math.max.apply(null, ls)) : 0;
  const meanL = ls.length ? Math.round(mean(ls)) : 0;

  console.log(`[beat] FINAL count=${beatCount} interval(ms) mean=${meanI} min=${minI} max=${maxI} jitter=${jitterI} | lateness(ms) mean=${meanL} min=${minL} max=${maxL}`);
}

    if (!isManualStop) {
      wx.showToast({
        title: (this.data.mode === "stage1")
          ? (passed ? "Stage1 达标，已解锁" : "Stage1 未达标")
          : "本轮结束",
        icon: "none"
      });
    }
  },

  onExport() {
    const payload = {
      meta: {
        mode: this.data.mode,
        tolMs: this.data.tolMs,
        durationSec: this.data.durationSec,
        bpm_stage1: this.data.bpm,
        passAccuracy: this.data.passAccuracy,
        bpmCur: this.data.bpmCur,
        range: this.data.range,
        nextBpm: this.data.nextBpm,
        // 保持字段结构不变：但统计基准改为 beats（漏点计为 miss）
        tapCount: this.data.beatCount,
        hitCount: this.data.hitCount,
        accuracy: this.data.beatCount ? (this.data.hitCount / this.data.beatCount) : 0
      },
      logs: this.data.logs
    };

    wx.setClipboardData({
      data: JSON.stringify(payload, null, 2),
      success: () => wx.showToast({ title: "已复制", icon: "success" }),
      fail: () => wx.showToast({ title: "复制失败", icon: "none" })
    });
  },

  onReset() {
    this.setData({
      beatCount: 0,
      tapCount: 0,
      hitCount: 0,
      lastErrMs: 0,
      accuracyPct: 0,
      hasResult: false,
      passed: false,
      logs: []
    });

    // reset beat-based scoring queue
    this._beatQueue = [];
    this._pendingNextHit = null;
  },
  onShow() {
    // When returning from background, resync scheduler to avoid burst "catch-up".
    if (this.data.isRunning && this._needsResyncOnShow) {
      this._needsResyncOnShow = false;
      this._resyncBeatScheduler('resume');
    }
  },

  onHide() {
    // stop any pending click when app goes background
    this._stopMetronome();

    // WeChat may pause timers in background; clearing the pending timeout prevents an
    // immediate burst on resume.
    if (this.data.isRunning) {
      clearTimeout(this._timerBeat);
      this._timerBeat = null;
      this._needsResyncOnShow = true;
    }
  },

  onUnload() {
    this._destroyMetronomeSound();
  }
});
