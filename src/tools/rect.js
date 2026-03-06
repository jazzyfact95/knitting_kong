(function () {
  const registry = (window.KnitChartTools = window.KnitChartTools || {});

  registry.rect = {
    id: "rect",
    label: "사각형",
    usesSymbol: true,
    startCell: null,
    onPointerDown: function (ctx, cell) {
      if (!cell) {
        return;
      }
      this.startCell = { row: cell.row, col: cell.col };
      ctx.setShapePreview(ctx.buildRectCells(this.startCell, cell, ctx.getState().shapeFill), ctx.getState().shapeFill ? "채운 사각형" : "사각형");
    },
    onPointerMove: function (ctx, cell) {
      if (!this.startCell || !cell) {
        return;
      }
      ctx.setShapePreview(ctx.buildRectCells(this.startCell, cell, ctx.getState().shapeFill), ctx.getState().shapeFill ? "채운 사각형" : "사각형");
    },
    onPointerUp: function (ctx, cell) {
      if (!this.startCell || !cell) {
        ctx.clearShapePreview();
        this.startCell = null;
        return;
      }
      ctx.paintPoints(ctx.buildRectCells(this.startCell, cell, ctx.getState().shapeFill), "shape-rect");
      ctx.clearShapePreview();
      this.startCell = null;
    },
  };
})();


