function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function mean(arr) { return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0; }
function randInt(a, b) {
  const lo = Math.ceil(Math.min(a, b));
  const hi = Math.floor(Math.max(a, b));
  return Math.floor(lo + Math.random() * (hi - lo + 1));
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

    // monkey animation (UI only)
    hitSide: 'R', // first beat => L
    leftArmAnim: {},
    rightArmAnim: {},
    drumAnim: {},
    bodyAnim: {},

    // stats
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

    // init monkey idle pose (UI only)
    this._initMonkeyUI();
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
      tapCount: 0,
      hitCount: 0,
      lastErrMs: 0,
      accuracyPct: 0,
      logs: []
    });

    this._setIdlePose();

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
    this.setData({ beatIntervalMs });
  },


  // ========== Monkey UI (UI only; driven by real beat tick) ==========
  _initMonkeyUI() {
    // Set a stable idle pose so arms don't jump when first animating
    this._setIdlePose();
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

  onStart() {
    if (this.data.isRunning) return;

    // stage2：每轮使用 nextBpm 作为本轮 bpm
    let runBpm = this.data.bpm;
    if (this.data.mode === "stage2") {
      runBpm = this.data.nextBpm;
      this._applyBpm(runBpm);
    } else {
      this._applyBpm(this.data.bpm);
    }

    const now = Date.now();
    this._beats = [];
    this._startTime = now;
    this._endTime = now + this.data.durationSec * 1000;
    this._nextBeatTime = now + this.data.beatIntervalMs;

    // Stage2：用于计算 acc10 / mean_err 的窗口
    this._last10 = []; // {hit, absErr}

    this.setData({
      isRunning: true,
      remainingSec: this.data.durationSec,
      tapCount: 0,
      hitCount: 0,
      lastErrMs: 0,
      accuracyPct: 0,
      hasResult: false,
      passed: false,
      logs: []
    });

    this._setIdlePose();

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

  _scheduleBeat() {
    if (!this.data.isRunning) return;

    const delay = Math.max(0, this._nextBeatTime - Date.now());
    this._timerBeat = setTimeout(() => {
      this._onBeatTick();
      this._nextBeatTime += this.data.beatIntervalMs;

      if (Date.now() >= this._endTime) return;
      this._scheduleBeat();
    }, delay);
  },

  _onBeatTick() {
    const t = this._nextBeatTime;
    this._beats.push(t);
    if (this._beats.length > 300) this._beats.shift();

    // Monkey hit (UI only) - strictly one hit per real beat tick
    this._triggerMonkeyHit();
  },

  onTapBeat() {
    if (!this.data.isRunning) return;

    const tapTime = Date.now();
    const beats = this._beats || [];
    if (!beats.length) return;

    // 最近 beat
    let bestBeat = beats[0];
    let bestAbs = Math.abs(tapTime - bestBeat);
    for (let i = 1; i < beats.length; i++) {
      const b = beats[i];
      const abs = Math.abs(tapTime - b);
      if (abs < bestAbs) {
        bestAbs = abs;
        bestBeat = b;
      }
    }

    const errMs = tapTime - bestBeat;
    const absErr = Math.abs(errMs);
    const hit = absErr <= this.data.tolMs;

    const tapCount = this.data.tapCount + 1;
    const hitCount = this.data.hitCount + (hit ? 1 : 0);
    const accuracy = tapCount ? hitCount / tapCount : 0;

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
      beatTime: bestBeat,
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

    this.setData({
      tapCount,
      hitCount,
      lastErrMs: Math.round(errMs),
      accuracyPct: Math.round(accuracy * 100),
      logs
    });
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
    const tapCount = this.data.tapCount;
    const hitCount = this.data.hitCount;
    const acc = tapCount ? hitCount / tapCount : 0;

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
        tapCount: this.data.tapCount,
        hitCount: this.data.hitCount,
        accuracy: this.data.tapCount ? (this.data.hitCount / this.data.tapCount) : 0
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
      tapCount: 0,
      hitCount: 0,
      lastErrMs: 0,
      accuracyPct: 0,
      hasResult: false,
      passed: false,
      logs: []
    });
  }
});
