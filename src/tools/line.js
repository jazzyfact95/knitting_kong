(function () {
  const registry = (window.KnitChartTools = window.KnitChartTools || {});

  registry.line = {
    id: "line",
    label: "직선",
    usesSymbol: true,
    startCell: null,
    onPointerDown: function (ctx, cell) {
      if (!cell) {
        return;
      }
      this.startCell = { row: cell.row, col: cell.col };
      ctx.setShapePreview(ctx.buildLineCells(this.startCell, cell), "직선");
    },
    onPointerMove: function (ctx, cell) {
      if (!this.startCell || !cell) {
        return;
      }
      ctx.setShapePreview(ctx.buildLineCells(this.startCell, cell), "직선");
    },
    onPointerUp: function (ctx, cell) {
      if (!this.startCell || !cell) {
        ctx.clearShapePreview();
        this.startCell = null;
        return;
      }
      ctx.paintPoints(ctx.buildLineCells(this.startCell, cell), "shape-line");
      ctx.clearShapePreview();
      this.startCell = null;
    },
  };
})();


