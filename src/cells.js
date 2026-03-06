(function () {
  function createCell(symbolId, fillColor) {
    return {
      symbolId: typeof symbolId === "string" && symbolId ? symbolId : "empty",
      fillColor: typeof fillColor === "string" ? fillColor : "",
    };
  }

  function normalizeCell(cell) {
    if (!cell || typeof cell !== "object" || Array.isArray(cell)) {
      return createCell(typeof cell === "string" ? cell : "empty", "");
    }
    return createCell(cell.symbolId || cell.id || "empty", cell.fillColor || "");
  }

  function cloneCell(cell) {
    var next = normalizeCell(cell);
    return createCell(next.symbolId, next.fillColor);
  }

  function symbolIdOf(cell) {
    return normalizeCell(cell).symbolId;
  }

  function fillColorOf(cell) {
    return normalizeCell(cell).fillColor;
  }

  function isEqual(a, b) {
    var left = normalizeCell(a);
    var right = normalizeCell(b);
    return left.symbolId === right.symbolId && left.fillColor === right.fillColor;
  }

  function isEmpty(cell) {
    return symbolIdOf(cell) === "empty" && !fillColorOf(cell);
  }

  function withPatch(cell, patch) {
    var current = normalizeCell(cell);
    if (patch && patch.clear) {
      return createCell("empty", "");
    }
    return createCell(
      patch && Object.prototype.hasOwnProperty.call(patch, "symbolId") ? patch.symbolId : current.symbolId,
      patch && Object.prototype.hasOwnProperty.call(patch, "fillColor") ? patch.fillColor : current.fillColor
    );
  }

  function normalizeMatrix(matrix) {
    if (!Array.isArray(matrix)) {
      return [];
    }
    return matrix.map(function (row) {
      if (!Array.isArray(row)) {
        return [];
      }
      return row.map(cloneCell);
    });
  }

  function normalizeGrid(grid, rows, cols) {
    var next = [];
    for (var r = 0; r < rows; r += 1) {
      var row = [];
      for (var c = 0; c < cols; c += 1) {
        row.push(cloneCell(grid && grid[r] && grid[r][c]));
      }
      next.push(row);
    }
    return next;
  }

  window.KnitChartCells = {
    createCell: createCell,
    normalizeCell: normalizeCell,
    cloneCell: cloneCell,
    symbolIdOf: symbolIdOf,
    fillColorOf: fillColorOf,
    isEqual: isEqual,
    isEmpty: isEmpty,
    withPatch: withPatch,
    normalizeMatrix: normalizeMatrix,
    normalizeGrid: normalizeGrid,
  };
})();
