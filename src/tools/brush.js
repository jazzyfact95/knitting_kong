(function () {
  const registry = (window.KnitChartTools = window.KnitChartTools || {});

  registry.brush = {
    id: "brush",
    label: "그리기",
    usesSymbol: true,
    dragging: false,
    lastCellKey: null,
    onPointerDown: function (ctx, cell) {
      if (!cell) {
        return;
      }
      this.dragging = true;
      this.lastCellKey = null;
      ctx.beginBatch("brush");
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
        ctx.endBatch("brush");
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
      const state = ctx.getState();
      ctx.paintCell(row, col, state.currentSymbol);
    },
  };
})();




