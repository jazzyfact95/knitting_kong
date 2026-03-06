(function () {
  const registry = (window.KnitChartTools = window.KnitChartTools || {});

  registry.eraser = {
    id: "eraser",
    label: "지우개",
    dragging: false,
    lastCellKey: null,
    onPointerDown: function (ctx, cell) {
      if (!cell) {
        return;
      }
      this.dragging = true;
      this.lastCellKey = null;
      ctx.beginBatch("eraser");
      this.apply(ctx, cell.row, cell.col);
    },
    onPointerMove: function (ctx, cell) {
      if (!this.dragging || !cell) {
        return;
      }
      this.apply(ctx, cell.row, cell.col);
    },
    onPointerUp: function (ctx) {
      if (this.dragging) {
        ctx.endBatch("eraser");
      }
      this.dragging = false;
      this.lastCellKey = null;
    },
    apply: function (ctx, row, col) {
      const key = row + ":" + col;
      if (key === this.lastCellKey) {
        return;
      }
      this.lastCellKey = key;
      ctx.clearCell(row, col);
    },
  };
})();
