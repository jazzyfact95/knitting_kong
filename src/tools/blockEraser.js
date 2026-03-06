(function () {
  const registry = (window.KnitChartTools = window.KnitChartTools || {});

  registry.blockEraser = {
    id: "blockEraser",
    label: "큰 지우개",
    dragging: false,
    lastCellKey: null,
    onPointerDown: function (ctx, cell) {
      if (!cell) {
        return;
      }
      this.dragging = true;
      this.lastCellKey = null;
      ctx.beginBatch("block-eraser");
      this.apply(ctx, cell);
    },
    onPointerMove: function (ctx, cell) {
      if (!this.dragging || !cell) {
        return;
      }
      this.apply(ctx, cell);
    },
    onPointerUp: function (ctx) {
      if (this.dragging) {
        ctx.endBatch("block-eraser");
      }
      this.dragging = false;
      this.lastCellKey = null;
      ctx.clearShapePreview();
    },
    apply: function (ctx, cell) {
      const key = cell.row + ":" + cell.col;
      if (key === this.lastCellKey) {
        return;
      }
      this.lastCellKey = key;
      const size = ctx.getState().eraserSize;
      const radius = Math.floor(size / 2);
      const preview = [];
      for (let row = cell.row + radius; row >= cell.row - radius; row -= 1) {
        for (let col = cell.col - radius; col <= cell.col + radius; col += 1) {
          preview.push({ row: row, col: col });
        }
      }
      ctx.setShapePreview(preview, "큰 지우개");
      ctx.eraseBlock(cell.row, cell.col, size);
    },
  };
})();
