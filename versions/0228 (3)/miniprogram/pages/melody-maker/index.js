Page({
  data: {
    cells: []
  },

  onLoad() {
    // 8x4 = 32 cells demo
    const cells = Array.from({ length: 32 }, () => ({ on: false }));
    this.setData({ cells });
  },

  goBack() { wx.navigateBack(); },

  toggleCell(e) {
    const i = Number(e.currentTarget.dataset.i);
    const cells = this.data.cells.slice();
    cells[i].on = !cells[i].on;
    this.setData({ cells });
  },

  clearAll() {
    const cells = this.data.cells.map(() => ({ on: false }));
    this.setData({ cells });
  }
});
