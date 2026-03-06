(function () {
  const cellUtils = window.KnitChartCells;

  function escapeXml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function getUsageCounts(state) {
    const counts = {};
    for (let r = 0; r < state.rows; r += 1) {
      for (let c = 0; c < state.cols; c += 1) {
        const id = cellUtils.symbolIdOf(state.grid[r][c]);
        if (id === "empty") {
          continue;
        }
        counts[id] = (counts[id] || 0) + 1;
      }
    }
    return counts;
  }

  function orderedLegendSymbols(state, pack) {
    const counts = getUsageCounts(state);
    const defaultOrder = pack.defaultOrder();
    const orderIndex = {};
    defaultOrder.forEach(function (id, index) {
      orderIndex[id] = index;
    });

    const symbols = pack.listSymbols().filter(function (symbol) {
      return symbol.id !== "empty" && (counts[symbol.id] || 0) > 0;
    });

    function rank(map, id) {
      return Object.prototype.hasOwnProperty.call(map, id) ? map[id] : 999;
    }

    if (state.symbolSortMode === "custom") {
      const customIndex = {};
      (state.customSymbolOrder || []).forEach(function (id, index) {
        customIndex[id] = index;
      });
      symbols.sort(function (a, b) {
        const diff = rank(customIndex, a.id) - rank(customIndex, b.id);
        if (diff !== 0) {
          return diff;
        }
        return rank(orderIndex, a.id) - rank(orderIndex, b.id);
      });
    } else if (state.symbolSortMode === "name") {
      symbols.sort(function (a, b) {
        const diff = a.name_ko.localeCompare(b.name_ko, "ko");
        if (diff !== 0) {
          return diff;
        }
        return rank(orderIndex, a.id) - rank(orderIndex, b.id);
      });
    } else {
      symbols.sort(function (a, b) {
        const diff = (counts[b.id] || 0) - (counts[a.id] || 0);
        if (diff !== 0) {
          return diff;
        }
        return rank(orderIndex, a.id) - rank(orderIndex, b.id);
      });
    }

    return symbols.map(function (symbol) {
      return {
        id: symbol.id,
        name_ko: symbol.name_ko,
        abbr: symbol.abbr,
        count: counts[symbol.id] || 0,
      };
    });
  }

  function buildSvg(state, options) {
    const opts = options || {};
    const includeLegend = opts.includeLegend !== false;
    const pack = window.KnitChartSymbols.getPack(state.packId);
    const symbols = orderedLegendSymbols(state, pack);

    const cell = state.cellSize;
    const chartW = state.cols * cell;
    const chartH = state.rows * cell;
    const marginLeft = state.view.showRowNumbers ? 46 : 16;
    const marginTop = state.view.showColNumbers ? 34 : 16;
    const padding = 14;
    const legendW = includeLegend ? 320 : 0;
    const notesH = state.notes.length ? 34 + state.notes.length * 18 : 0;

    const width = padding * 2 + marginLeft + chartW + legendW;
    const height = padding * 2 + marginTop + chartH + 58 + notesH;

    const chartX = padding + marginLeft;
    const chartY = padding + marginTop;
    const body = [];

    body.push('<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="#ffffff" />');
    body.push('<text x="' + chartX + '" y="18" font-size="16" fill="#0f172a" font-weight="700">' + escapeXml(state.title || "Knit Chart") + '</text>');
    body.push('<rect x="' + chartX + '" y="' + chartY + '" width="' + chartW + '" height="' + chartH + '" fill="#ffffff" stroke="#111827" stroke-width="1.2" />');

    const currentDisplayRow = state.rows - state.currentRow;
    body.push('<rect x="' + chartX + '" y="' + (chartY + currentDisplayRow * cell) + '" width="' + chartW + '" height="' + cell + '" fill="#e0f2fe" opacity="0.6" />');

    for (let row = 0; row < state.rows; row += 1) {
      for (let col = 0; col < state.cols; col += 1) {
        const current = cellUtils.normalizeCell(state.grid[row][col]);
        const displayRow = state.rows - 1 - row;
        const x = chartX + col * cell;
        const y = chartY + displayRow * cell;
        if (current.fillColor) {
          body.push('<rect x="' + x + '" y="' + y + '" width="' + cell + '" height="' + cell + '" fill="' + escapeXml(current.fillColor) + '" />');
        }
      }
    }

    if (state.view.showGrid) {
      for (let c = 0; c <= state.cols; c += 1) {
        const x = chartX + c * cell;
        body.push('<line x1="' + x + '" y1="' + chartY + '" x2="' + x + '" y2="' + (chartY + chartH) + '" stroke="#d1d5db" stroke-width="1" />');
      }
      for (let r = 0; r <= state.rows; r += 1) {
        const y = chartY + r * cell;
        body.push('<line x1="' + chartX + '" y1="' + y + '" x2="' + (chartX + chartW) + '" y2="' + y + '" stroke="#d1d5db" stroke-width="1" />');
      }
    }

    for (let row = 0; row < state.rows; row += 1) {
      for (let col = 0; col < state.cols; col += 1) {
        const id = cellUtils.symbolIdOf(state.grid[row][col]);
        if (!id || id === "empty") {
          continue;
        }
        const displayRow = state.rows - 1 - row;
        const x = chartX + col * cell;
        const y = chartY + displayRow * cell;
        body.push(pack.symbolToSvgGroup(id, x, y, cell, "#111827"));
      }
    }

    state.repeatBoxes.forEach(function (box) {
      const rowMin = Math.min(box.rowStart, box.rowEnd);
      const rowMax = Math.max(box.rowStart, box.rowEnd);
      const colMin = Math.min(box.colStart, box.colEnd);
      const colMax = Math.max(box.colStart, box.colEnd);
      const x = chartX + colMin * cell;
      const y = chartY + (state.rows - 1 - rowMax) * cell;
      const w = (colMax - colMin + 1) * cell;
      const h = (rowMax - rowMin + 1) * cell;
      body.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="none" stroke="#b45309" stroke-width="2" stroke-dasharray="6 4" />');
      body.push('<text x="' + (x + 6) + '" y="' + (y + 14) + '" font-size="12" fill="#92400e" font-weight="700">' + escapeXml(box.label || ("x" + box.times)) + '</text>');
    });

    state.notes.forEach(function (note) {
      const displayRow = state.rows - 1 - note.row;
      const x = chartX + note.col * cell + cell + 4;
      const y = chartY + displayRow * cell + 4;
      body.push('<rect x="' + x + '" y="' + y + '" rx="4" ry="4" width="170" height="18" fill="#fef3c7" stroke="#f59e0b" stroke-width="1" />');
      body.push('<text x="' + (x + 5) + '" y="' + (y + 13) + '" font-size="11" fill="#7c2d12">' + escapeXml(note.text) + '</text>');
    });

    if (state.view.showRowNumbers) {
      for (let rNum = 1; rNum <= state.rows; rNum += 1) {
        const y = chartY + (state.rows - rNum) * cell + cell * 0.66;
        body.push('<text x="' + (chartX - 28) + '" y="' + y + '" font-size="12" fill="#334155">' + rNum + '</text>');
      }
    }

    if (state.view.showColNumbers) {
      for (let cNum = 1; cNum <= state.cols; cNum += 1) {
        const x = chartX + (cNum - 1) * cell + cell * 0.28;
        body.push('<text x="' + x + '" y="' + (chartY - 8) + '" font-size="12" fill="#334155">' + cNum + '</text>');
      }
    }

    const direction = window.KnitChartStore.getRowDirection(state, state.currentRow);
    const arrowText = direction === "rtl" ? "<-" : "->";
    const directionLabel = direction === "rtl" ? "오른쪽→왼쪽" : "왼쪽→오른쪽";
    const rowSurface = window.KnitChartStore.getRowSurface(state, state.currentRow);
    const rowSurfaceLabel = rowSurface === "RS" ? "겉면(RS)" : "안쪽면(WS)";
    body.push('<text x="' + chartX + '" y="' + (chartY + chartH + 24) + '" font-size="13" fill="#0f172a" font-weight="700">현재 단 ' + state.currentRow + ' (' + rowSurfaceLabel + ') ' + arrowText + ' ' + directionLabel + '</text>');
    if (state.chartMode === "flat" && state.evenRowInterpretHelp && state.currentRow % 2 === 0) {
      body.push('<text x="' + chartX + '" y="' + (chartY + chartH + 42) + '" font-size="11" fill="#7c2d12">짝수단 해석 도움말: WS에서 겉/안을 반대로 읽도록 안내 중</text>');
    }

    if (includeLegend) {
      const legendX = chartX + chartW + 18;
      body.push('<text x="' + legendX + '" y="' + (chartY + 12) + '" font-size="14" fill="#111827" font-weight="700">사용한 기호 설명 (KO_KNIT)</text>');
      symbols.forEach(function (item, index) {
        const y = chartY + 30 + index * 30;
        body.push('<rect x="' + legendX + '" y="' + y + '" width="22" height="22" fill="#ffffff" stroke="#cbd5e1" />');
        body.push(pack.symbolToSvgGroup(item.id, legendX, y, 22, "#111827"));
        body.push('<text x="' + (legendX + 30) + '" y="' + (y + 15) + '" font-size="12" fill="#111827">' + escapeXml(item.name_ko) + ' (' + escapeXml(item.abbr) + ') x ' + item.count + '</text>');
      });
    }

    if (state.notes.length) {
      const notesX = chartX;
      const notesY = chartY + chartH + 64;
      body.push('<text x="' + notesX + '" y="' + notesY + '" font-size="13" fill="#111827" font-weight="700">메모</text>');
      state.notes.forEach(function (note, index) {
        body.push('<text x="' + notesX + '" y="' + (notesY + 18 + index * 16) + '" font-size="12" fill="#334155">' + escapeXml((index + 1) + '. ' + note.text) + '</text>');
      });
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' + body.join("") + '</svg>';
  }

  function downloadSvg(state, options) {
    const svg = buildSvg(state, options);
    const name = (state.title || "knit-chart").replace(/[^a-zA-Z0-9-_]/g, "_");
    window.KnitChartExportJson.downloadText(name + ".svg", svg, "image/svg+xml;charset=utf-8");
    return svg;
  }

  window.KnitChartExportSvg = {
    buildSvg: buildSvg,
    downloadSvg: downloadSvg,
    orderedLegendSymbols: orderedLegendSymbols,
  };
})();
