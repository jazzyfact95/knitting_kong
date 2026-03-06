(function () {
  const registry = (window.KnitChartTools = window.KnitChartTools || {});

  registry.circle = {
    id: "circle",
    label: "원",
    usesSymbol: true,
    startCell: null,
    onPointerDown: function (ctx, cell) {
      if (!cell) {
        return;
      }
      this.startCell = { row: cell.row, col: cell.col };
      ctx.setShapePreview(ctx.buildEllipseCells(this.startCell, cell, ctx.getState().shapeFill), ctx.getState().shapeFill ? "채운 원" : "원");
    },
    onPointerMove: function (ctx, cell) {
      if (!this.startCell || !cell) {
        return;
      }
      ctx.setShapePreview(ctx.buildEllipseCells(this.startCell, cell, ctx.getState().shapeFill), ctx.getState().shapeFill ? "채운 원" : "원");
    },
    onPointerUp: function (ctx, cell) {
      if (!this.startCell || !cell) {
        ctx.clearShapePreview();
        this.startCell = null;
        return;
      }
      ctx.paintPoints(ctx.buildEllipseCells(this.startCell, cell, ctx.getState().shapeFill), "shape-circle");
      ctx.clearShapePreview();
      this.startCell = null;
    },
  };
})();


