(function () {
  const registry = (window.KnitChartTools = window.KnitChartTools || {});

  registry.fill = {
    id: "fill",
    label: "기호 채우기",
    usesSymbol: true,
    onPointerDown: function (ctx, cell) {
      if (!cell) {
        return;
      }
      const state = ctx.getState();
      ctx.floodFill(cell.row, cell.col, state.currentSymbol);
    },
    onPointerMove: function () {},
    onPointerUp: function () {},
  };
})();


