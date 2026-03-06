(function () {
  const registry = (window.KnitChartTools = window.KnitChartTools || {});

  registry.select = {
    id: "select",
    label: "영역 선택",
    dragging: false,
    onPointerDown: function (ctx, cell) {
      if (!cell) {
        return;
      }
      this.dragging = true;
      ctx.updateSelection(cell.row, cell.col, cell.row, cell.col, true);
    },
    onPointerMove: function (ctx, cell) {
      if (!this.dragging || !cell) {
        return;
      }
      const sel = ctx.getState().selection;
      if (!sel) {
        return;
      }
      ctx.updateSelection(sel.rowStart, sel.colStart, cell.row, cell.col, false);
    },
    onPointerUp: function (ctx) {
      if (this.dragging) {
        ctx.normalizeSelection();
      }
      this.dragging = false;
    },
  };
})();


