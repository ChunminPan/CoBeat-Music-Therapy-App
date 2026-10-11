// components/drum-character/index.js
// 三帧精灵图版本：更贴近参考视频，不用旋转 view 以避免错位/漂移

const FRAME0 = '/assets/drummer/frame0.png'; // 抬起/静止
const FRAME1 = '/assets/drummer/frame1.png'; // 打到最低点
const FRAME2 = '/assets/drummer/frame2.png'; // 回位过渡

Component({
  properties: {
    // 每拍自增序号：确保每次变化都能触发一次性敲击序列
    hitSeq: {
      type: Number,
      value: 0,
      observer(newVal, oldVal) {
        if (newVal === oldVal) return;
        this.triggerBeat();
      }
    }
  },

  data: {
    spriteSrc: FRAME0
  },

  lifetimes: {
    attached() {
      this._clearTimers();
      this.setData({ spriteSrc: FRAME0 });
    },
    detached() {
      this._clearTimers();
    }
  },

  methods: {
    _clearTimers() {
      if (this._t1) clearTimeout(this._t1);
      if (this._t2) clearTimeout(this._t2);
      this._t1 = null;
      this._t2 = null;
    },

    // 每拍调用一次：下敲 -> 回位（同一次动作；视觉只算“一下”）
    triggerBeat() {
      this._clearTimers();

      // 参考视频的节奏观感：快速打下去，稍快回位
      const downDur = 90; // 70~100ms
      const midDur = 70;  // 60~90ms

      // 1) 打到鼓面最低点
      this.setData({ spriteSrc: FRAME1 });

      // 2) 回位过渡
      this._t1 = setTimeout(() => {
        this.setData({ spriteSrc: FRAME2 });
      }, downDur);

      // 3) 回到抬起/静止
      this._t2 = setTimeout(() => {
        this.setData({ spriteSrc: FRAME0 });
      }, downDur + midDur);
    }
  }
});
