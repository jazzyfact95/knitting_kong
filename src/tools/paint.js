(function () {
  const registry = (window.KnitChartTools = window.KnitChartTools || {});

  registry.paint = {
    id: "paint",
    label: "칠 도구",
    usesColor: true,
    dragging: false,
    lastCellKey: null,
    onPointerDown: function (ctx, cell) {
      if (!cell) {
        return;
      }
      this.dragging = true;
      this.lastCellKey = null;
      ctx.beginBatch("paint-color");
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
        ctx.endBatch("paint-color");
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
      ctx.paintCellColor(row, col, ctx.getState().currentFillColor);
    },
  };
})();
