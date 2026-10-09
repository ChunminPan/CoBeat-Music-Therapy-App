Page({
  data: {
    running: false,
    remain: 10,
    taps: 0,
    timer: null
  },

  onUnload() {
    this._clear();
  },

  goBack() { wx.navigateBack(); },

  _clear() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
      this.setData({ timer: null });
    }
  },

  reset() {
    this._clear();
    this.setData({ running: false, remain: 10, taps: 0 });
  },

  toggle() {
    if (this.data.running) {
      this._clear();
      this.setData({ running: false });
      return;
    }
    // start
    this.setData({ running: true });
    const t = setInterval(() => {
      const r = this.data.remain - 1;
      if (r <= 0) {
        this._clear();
        this.setData({ running: false, remain: 0 });
        wx.showModal({
          title: "结束",
          content: `Demo结束：共点击 ${this.data.taps} 次。`,
          showCancel: false
        });
      } else {
        this.setData({ remain: r });
      }
    }, 1000);
    this.setData({ timer: t });
  },

  doTap() {
    if (!this.data.running) return;
    this.setData({ taps: this.data.taps + 1 });
  }
});
