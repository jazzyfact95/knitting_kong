(function () {
  const registry = (window.KnitChartTools = window.KnitChartTools || {});

  registry.textNote = {
    id: "textNote",
    label: "메모",
    onPointerDown: function (ctx, cell) {
      if (!cell) {
        return;
      }
      const text = window.prompt("메모 내용을 입력하세요", "2코 고무뜨기 시작");
      if (!text) {
        return;
      }
      ctx.addNote(cell.row, cell.col, text.trim());
    },
    onPointerMove: function () {},
    onPointerUp: function () {},
  };
})();



