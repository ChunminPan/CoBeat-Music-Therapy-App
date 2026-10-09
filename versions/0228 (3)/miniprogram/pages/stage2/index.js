Page({
  data: { segment: 1 },

  goBack() { wx.navigateBack(); },

  next() {
    let s = this.data.segment + 1;
    if (s > 4) {
      wx.showModal({ title: "完成", content: "Demo完成：4段结束。", showCancel: false });
      s = 1;
    }
    this.setData({ segment: s });
  }
});
