(function () {
  const AUTOSAVE_KEY = "knitchart_studio_autosave_v2";
  const cellUtils = window.KnitChartCells;

  function $(id) {
    return document.getElementById(id);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getPack(state) {
    return window.KnitChartSymbols.getPack(state.packId);
  }

  const TOOL_SHORTCUTS = {
    brush: "B",
    paint: "C",
    eraser: "E",
    blockEraser: "Shift+E",
    select: "Q",
    fill: "F",
    line: "L",
    rect: "R",
    circle: "O",
    repeatBox: "X",
    textNote: "N",
    pan: "M",
  };

  const ACTION_SHORTCUTS = [
    { selector: "#btn-open-left", key: "D" },
    { selector: "#btn-mobile-symbols", key: "D" },
    { selector: "#btn-mobile-nav-symbols", key: "D" },
    { selector: "#btn-save-pattern", key: "Alt+S" },
    { selector: "#btn-mobile-save-pattern", key: "Alt+S" },
    { selector: "#btn-save-stamp", key: "Alt+S" },
    { selector: "#btn-mobile-nav-check", key: "Alt+S" },
    { selector: "#btn-open-pattern-screen", key: "P" },
    { selector: "#btn-mobile-pattern-screen", key: "P" },
    { selector: "#btn-mobile-nav-settings", key: "P" },
  ];

  function getToolDefinition(toolId) {
    return (window.KnitChartTools && window.KnitChartTools[toolId]) || { id: toolId, label: toolId };
  }

  function getToolShortcut(toolId) {
    return TOOL_SHORTCUTS[toolId] || "";
  }

  function toolUsesSymbol(toolId) {
    return !!getToolDefinition(toolId).usesSymbol;
  }

  function toolUsesColor(toolId) {
    return !!getToolDefinition(toolId).usesColor;
  }

  function symbolMatchesQuery(symbol, query) {
    if (!query) {
      return true;
    }
    const haystack = [symbol.name_ko, symbol.abbr, symbol.category, symbol.id]
      .join(" ")
      .toLowerCase();
    return haystack.indexOf(query) >= 0;
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

  function getOrderedSymbols(state, includeUnused) {
    const pack = getPack(state);
    const counts = getUsageCounts(state);
    const symbols = pack.listSymbols().slice();
    const defaultOrder = pack.defaultOrder();
    const orderIndex = {};
    const pinnedLast = { empty: true };

    defaultOrder.forEach(function (id, index) {
      orderIndex[id] = index;
    });

    function comparePinned(a, b) {
      const aPinned = !!pinnedLast[a.id];
      const bPinned = !!pinnedLast[b.id];
      if (aPinned === bPinned) {
        return 0;
      }
      return aPinned ? 1 : -1;
    }

    function rank(map, id) {
      return Object.prototype.hasOwnProperty.call(map, id) ? map[id] : 999;
    }

    if (state.symbolSortMode === "custom") {
      const customIndex = {};
      state.customSymbolOrder.forEach(function (id, index) {
        customIndex[id] = index;
      });
      symbols.sort(function (a, b) {
        const pinned = comparePinned(a, b);
        if (pinned !== 0) {
          return pinned;
        }
        const diff = rank(customIndex, a.id) - rank(customIndex, b.id);
        if (diff !== 0) {
          return diff;
        }
        return rank(orderIndex, a.id) - rank(orderIndex, b.id);
      });
    } else if (state.symbolSortMode === "name") {
      symbols.sort(function (a, b) {
        const pinned = comparePinned(a, b);
        if (pinned !== 0) {
          return pinned;
        }
        const diff = a.name_ko.localeCompare(b.name_ko, "ko");
        if (diff !== 0) {
          return diff;
        }
        return rank(orderIndex, a.id) - rank(orderIndex, b.id);
      });
    } else {
      symbols.sort(function (a, b) {
        const pinned = comparePinned(a, b);
        if (pinned !== 0) {
          return pinned;
        }
        const countDiff = (counts[b.id] || 0) - (counts[a.id] || 0);
        if (countDiff !== 0) {
          return countDiff;
        }
        return rank(orderIndex, a.id) - rank(orderIndex, b.id);
      });
    }

    const mapped = symbols.map(function (symbol) {
      return {
        symbol: symbol,
        count: counts[symbol.id] || 0,
      };
    });

    if (includeUnused) {
      return mapped;
    }

    return mapped.filter(function (item) {
      return item.symbol.id !== "empty" && item.count > 0;
    });
  }

  function getLegendRows(state) {
    const pack = getPack(state);
    return getOrderedSymbols(state, false).map(function (item) {
      return {
        id: item.symbol.id,
        name_ko: item.symbol.name_ko,
        abbr: item.symbol.abbr,
        count: item.count,
        svg: pack.createPreviewSvg(item.symbol.id, 22),
      };
    });
  }

  function describeNarrativeSymbol(state, rowNumber, symbolId, pack) {
    const symbol = pack.getSymbol(symbolId);
    if (state.chartMode === "flat" && state.evenRowInterpretHelp && rowNumber % 2 === 0) {
      const helperLabels = {
        knit: "겉뜨기(WS에서는 안뜨기처럼 해석)",
        purl: "안뜨기(WS에서는 겉뜨기처럼 해석)",
        ktbl: "꼬아겉뜨기(WS에서는 꼬아안처럼 해석)",
        ptbl: "꼬아안뜨기(WS에서는 꼬아겉처럼 해석)",
      };
      return helperLabels[symbolId] || symbol.name_ko;
    }
    return symbol.name_ko;
  }

  function compressNarrativeSegments(segments) {
    for (let size = 1; size <= Math.floor(segments.length / 2); size += 1) {
      if (segments.length % size !== 0) {
        continue;
      }
      const repeatCount = segments.length / size;
      if (repeatCount < 2) {
        continue;
      }
      let matches = true;
      for (let index = size; index < segments.length; index += 1) {
        const reference = segments[index % size];
        const current = segments[index];
        if (!reference || reference.id !== current.id || reference.count !== current.count) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return {
          block: segments.slice(0, size),
          repeatCount: repeatCount,
        };
      }
    }
    return null;
  }

  function formatNarrativeSegments(segments, formatter) {
    return segments.map(function (segment) {
      return formatter(segment.id) + " " + segment.count;
    }).join(", ");
  }

  function formatSurfaceLabel(surface) {
    return surface === "RS" ? "겉면(RS)" : "안쪽면(WS)";
  }

  function rowNarrative(state, rowNumber) {
    const pack = getPack(state);
    const direction = window.KnitChartStore.getRowDirection(state, rowNumber);
    const surface = formatSurfaceLabel(window.KnitChartStore.getRowSurface(state, rowNumber));
    const rowIndex = rowNumber - 1;
    const cols = [];

    if (direction === "rtl") {
      for (let c = state.cols - 1; c >= 0; c -= 1) {
        cols.push(c);
      }
    } else {
      for (let c = 0; c < state.cols; c += 1) {
        cols.push(c);
      }
    }

    const sequence = [];
    cols.forEach(function (col) {
      const symbolId = cellUtils.symbolIdOf(state.grid[rowIndex][col]);
      if (symbolId !== "empty" && symbolId !== "noStitch") {
        sequence.push(symbolId);
      }
    });

    if (!sequence.length) {
      return rowNumber + "단(" + surface + "): 비어 있음";
    }

    const segments = [];
    let current = sequence[0];
    let count = 1;
    for (let i = 1; i < sequence.length; i += 1) {
      if (sequence[i] === current) {
        count += 1;
      } else {
        segments.push({ id: current, count: count });
        current = sequence[i];
        count = 1;
      }
    }
    segments.push({ id: current, count: count });

    const formatter = function (symbolId) {
      return describeNarrativeSymbol(state, rowNumber, symbolId, pack);
    };
    const compressed = compressNarrativeSegments(segments);
    const description = compressed
      ? formatNarrativeSegments(compressed.block, formatter) + " 반복 x" + compressed.repeatCount
      : formatNarrativeSegments(segments, formatter);

    return rowNumber + "단(" + surface + ", " + (direction === "rtl" ? "오른쪽→왼쪽" : "왼쪽→오른쪽") + "): " + description;
  }

  function generateNarrative(state) {
    const lines = [];
    for (let row = 1; row <= state.rows; row += 1) {
      lines.push(rowNarrative(state, row));
    }
    return lines.join("\n");
  }

  function resizeGridKeepData(state, newRows, newCols) {
    const rows = clamp(Number(newRows) || state.rows, 1, 400);
    const cols = clamp(Number(newCols) || state.cols, 1, 400);
    const nextGrid = [];
    for (let r = 0; r < rows; r += 1) {
      const row = [];
      for (let c = 0; c < cols; c += 1) {
        row.push(r < state.rows && c < state.cols ? cellUtils.cloneCell(state.grid[r][c]) : cellUtils.createCell("empty", ""));
      }
      nextGrid.push(row);
    }
    state.rows = rows;
    state.cols = cols;
    state.grid = nextGrid;
    state.currentRow = clamp(state.currentRow, 1, rows);
    state.cursor.row = clamp(state.cursor.row, 0, rows - 1);
    state.cursor.col = clamp(state.cursor.col, 0, cols - 1);
    state.notes = state.notes.filter(function (note) {
      return note.row < rows && note.col < cols;
    });
    state.repeatBoxes = state.repeatBoxes.filter(function (box) {
      return box.rowStart < rows && box.rowEnd < rows && box.colStart < cols && box.colEnd < cols;
    });
  }

  function moveOrder(order, id, direction) {
    const list = order.slice();
    const index = list.indexOf(id);
    if (index < 0) {
      return list;
    }
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= list.length) {
      return list;
    }
    const temp = list[index];
    list[index] = list[nextIndex];
    list[nextIndex] = temp;
    return list;
  }

  function loadAutosavedState() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) {
        return null;
      }
      return window.KnitChartStore.normalizeImportedState(JSON.parse(raw));
    } catch (error) {
      console.warn("autosave load failed", error);
      return null;
    }
  }

  function saveAutosavedState(state) {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("autosave save failed", error);
    }
  }

  const initialState = loadAutosavedState() || window.KnitChartStore.createInitialState({ rows: 24, cols: 24 });
  const store = window.KnitChartStore.createStore(initialState);
  const editor = window.KnitChartEditorCanvas.createEditorCanvas($("editor-canvas"), store);

  const ui = {
    body: document.body,
    scrim: $("scrim"),
    toastStack: $("toast-stack"),
    btnNew: $("btn-new"),
    btnSaveJson: $("btn-save-json"),
    btnLoadJson: $("btn-load-json"),
    inputLoadJson: $("input-load-json"),
    btnExportSvg: $("btn-export-svg"),
    btnExportPng: $("btn-export-png"),
    btnPrint: $("btn-print"),
    btnUndo: $("btn-undo"),
    btnRedo: $("btn-redo"),
    btnFloatUndo: $("btn-float-undo"),
    btnFloatRedo: $("btn-float-redo"),
    btnOpenLeft: $("btn-open-left"),
    btnOpenRight: $("btn-open-right"),
    btnOpenSettings: $("btn-open-settings"),
    btnCloseSettings: $("btn-close-settings"),
    btnClosePatternScreen: $("btn-close-pattern-screen"),
    btnMobileSymbols: $("btn-mobile-symbols"),
    btnMobileTools: $("btn-mobile-tools"),
    btnMobileInspect: $("btn-mobile-inspect"),
    btnMobileSettings: $("btn-mobile-settings"),
    btnMobileNavSymbols: $("btn-mobile-nav-symbols"),
    btnMobileNavTools: $("btn-mobile-nav-tools"),
    btnMobileNavCheck: $("btn-mobile-nav-check"),
    btnMobileNavSettings: $("btn-mobile-nav-settings"),
    btnCloseLeftPanel: $("btn-close-left-panel"),
    btnCloseRightPanel: $("btn-close-right-panel"),
    btnZoomOut: $("btn-zoom-out"),
    btnZoomIn: $("btn-zoom-in"),
    btnZoomReset: $("btn-zoom-reset"),
    zoomLabel: $("zoom-label"),
    rowReadout: $("row-readout"),
    activeIndicators: $("active-indicators"),
    selectionGlance: $("selection-glance"),
    statusLine: $("status-line"),
    cursorLine: $("cursor-line"),
    symbolPalette: $("symbol-palette"),
    symbolSearch: $("symbol-search"),
    toolButtons: Array.from(document.querySelectorAll(".tool-btn")),
    btnSavePattern: $("btn-save-pattern"),
    btnMobileSavePattern: $("btn-mobile-save-pattern"),
    btnOpenPatternScreen: $("btn-open-pattern-screen"),
    btnMobilePatternScreen: $("btn-mobile-pattern-screen"),
    btnPatternPasteMode: $("btn-pattern-paste-mode"),
    btnCancelPaste: $("btn-cancel-paste"),
    btnMirrorH: $("btn-mirror-h"),
    btnMirrorV: $("btn-mirror-v"),
    btnSelectionClear: $("btn-selection-clear"),
    repeatTimes: $("repeat-times"),
    btnAddRepeat: $("btn-add-repeat"),
    rowIndex: $("row-index"),
    rowCount: $("row-count"),
    btnRowInsert: $("btn-row-insert"),
    btnRowDelete: $("btn-row-delete"),
    colIndex: $("col-index"),
    colCount: $("col-count"),
    btnColInsert: $("btn-col-insert"),
    btnColDelete: $("btn-col-delete"),
    stampName: $("stamp-name"),
    btnSaveStamp: $("btn-save-stamp"),
    stampList: $("stamp-list"),
    btnDeleteStamp: $("btn-delete-stamp"),
    patternPickerList: $("pattern-picker-list"),
    patternPreviewBoard: $("pattern-preview-board"),
    patternPreviewMeta: $("pattern-preview-meta"),
    btnPatternApply: $("btn-pattern-apply"),
    btnPatternDelete: $("btn-pattern-delete"),
    gridCols: $("grid-cols"),
    gridRows: $("grid-rows"),
    cellSize: $("cell-size"),
    btnApplyGrid: $("btn-apply-grid"),
    chartMode: $("chart-mode"),
    circularDirection: $("circular-direction"),
    evenRowHelp: $("even-row-help"),
    edgeSlipGuide: $("edge-slip-guide"),
    showGrid: $("show-grid"),
    showRowNumbers: $("show-row-numbers"),
    showColNumbers: $("show-col-numbers"),
    legendInSvg: $("legend-in-svg"),
    rowJump: $("row-jump"),
    btnRowJump: $("btn-row-jump"),
    cellFillColor: $("cell-fill-color"),
    btnClearFillColor: $("btn-clear-fill-color"),
    applyFillColor: $("apply-fill-color"),
    shapeFill: $("shape-fill"),
    eraserSize: $("eraser-size"),
    legendTableBody: document.querySelector("#legend-table tbody"),
    narrativeOutput: $("narrative-output"),
    noteList: $("note-list"),
    symbolSortMode: $("symbol-sort-mode"),
    symbolSettingsSearch: $("symbol-settings-search"),
    btnResetSymbolOrder: $("btn-reset-symbol-order"),
    symbolSettingsList: $("symbol-settings-list"),
  };

  let autosaveTimer = null;
  const feedbackSnapshot = {
    tool: null,
    symbol: null,
    row: null,
    stamp: null,
  };

  function triggerFeedback(node, className) {
    if (!node || !className) {
      return;
    }
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
    if (node.__feedbackTimer) {
      clearTimeout(node.__feedbackTimer);
    }
    node.__feedbackTimer = setTimeout(function () {
      node.classList.remove(className);
    }, 620);
  }

  function syncFeedbackState(state) {
    if (feedbackSnapshot.tool !== null && feedbackSnapshot.tool !== state.currentTool) {
      triggerFeedback(ui.statusLine, "feedback-pulse");
    }
    if (feedbackSnapshot.symbol !== null && feedbackSnapshot.symbol !== state.currentSymbol) {
      triggerFeedback(ui.rowReadout, "feedback-pulse");
    }
    if (feedbackSnapshot.row !== null && feedbackSnapshot.row !== state.currentRow) {
      triggerFeedback(ui.rowReadout, "feedback-select");
    }
    if (feedbackSnapshot.stamp !== null && feedbackSnapshot.stamp !== state.currentStampId) {
      triggerFeedback(ui.patternPreviewMeta, "feedback-pulse");
    }
    feedbackSnapshot.tool = state.currentTool;
    feedbackSnapshot.symbol = state.currentSymbol;
    feedbackSnapshot.row = state.currentRow;
    feedbackSnapshot.stamp = state.currentStampId;
  }

  function bindInteractionFeedback() {
    document.body.addEventListener("pointerdown", function (event) {
      const target = event.target.closest("button, .symbol-btn, .stamp-item, .brand-link");
      if (target) {
        triggerFeedback(target, "feedback-pop");
      }
    });
    document.body.addEventListener("click", function (event) {
      const target = event.target.closest(".symbol-btn, .tool-btn, .stamp-item, [data-picker-stamp], [data-stamp-select], .brand-link");
      if (target) {
        triggerFeedback(target, "feedback-select");
      }
    });
    document.body.addEventListener("change", function (event) {
      const target = event.target.closest("input, select, textarea");
      if (target) {
        triggerFeedback(target, "feedback-change");
      }
    });
  }

  function attachShortcutBadge(button, label) {
    if (!button || !label) {
      return;
    }
    const textLabel = button.textContent.trim();
    button.title = textLabel + " (" + label + ")";
    if (button.querySelector(".shortcut-badge")) {
      button.querySelector(".shortcut-badge").textContent = label;
      return;
    }
    const badge = document.createElement("span");
    badge.className = "shortcut-badge";
    badge.textContent = label;
    button.appendChild(badge);
  }

  function installShortcutBadges() {
    Object.keys(TOOL_SHORTCUTS).forEach(function (toolId) {
      document.querySelectorAll('[data-tool="' + toolId + '"]').forEach(function (button) {
        if (button.closest(".action-dock")) {
          return;
        }
        attachShortcutBadge(button, TOOL_SHORTCUTS[toolId]);
      });
    });
    ACTION_SHORTCUTS.forEach(function (entry) {
      document.querySelectorAll(entry.selector).forEach(function (button) {
        if (button.closest(".action-dock")) {
          return;
        }
        attachShortcutBadge(button, entry.key);
      });
    });
  }
  function isCompactScreen() {
    return window.matchMedia("(max-width: 980px)").matches;
  }

  function closeDrawersForCompact() {
    if (isCompactScreen()) {
      setOverlay(null);
    }
  }

  function setStatus(text) {
    ui.statusLine.textContent = text;
  }

  function showToast(message, tone) {
    if (!ui.toastStack || !message) {
      return;
    }
    const toast = document.createElement("div");
    toast.className = "toast toast--" + (tone || "info");
    toast.setAttribute("role", "status");
    toast.textContent = message;
    ui.toastStack.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add("is-visible");
    });
    window.setTimeout(function () {
      toast.classList.remove("is-visible");
      toast.classList.add("is-leaving");
      window.setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 260);
    }, 2400);
  }
  function setOverlay(mode) {
    ui.body.classList.toggle("show-left-panel", mode === "left");
    ui.body.classList.toggle("show-right-panel", mode === "right");
    ui.body.classList.toggle("show-settings", mode === "settings");
    ui.body.classList.toggle("show-pattern-screen", mode === "pattern");
  }

  function openLeft(sectionId) {
    setOverlay("left");
    if (sectionId) {
      const section = $(sectionId);
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  function openRight(sectionId) {
    setOverlay("right");
    if (sectionId) {
      const section = $(sectionId);
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  function renderSymbolPalette(state) {
    const pack = getPack(state);
    const query = ((ui.symbolSearch && ui.symbolSearch.value) || "").trim().toLowerCase();
    const ordered = getOrderedSymbols(state, true).filter(function (item) {
      return symbolMatchesQuery(item.symbol, query);
    });

    if (!ordered.length) {
      ui.symbolPalette.innerHTML = '<div class="stamp-item">검색 결과가 없습니다.</div>';
      return;
    }

    ui.symbolPalette.innerHTML = ordered.map(function (item) {
      const symbol = item.symbol;
      const activeClass = state.currentSymbol === symbol.id ? " active" : "";
      const metaParts = [symbol.abbr];
      if (item.count > 0) {
        metaParts.push("사용 " + item.count + "회");
      } else if (symbol.id === "empty") {
        metaParts.push("배경만 칠할 때 사용");
      }
      return '<button class="symbol-btn' + activeClass + '" data-symbol="' + symbol.id + '">' +
        '<span class="legend-cell-icon">' + pack.createPreviewSvg(symbol.id, 26) + '</span>' +
        '<span>' + escapeHtml(symbol.name_ko) + '</span>' +
        '<small>' + escapeHtml(metaParts.join(" · ")) + '</small>' +
        '</button>';
    }).join("");

    Array.from(ui.symbolPalette.querySelectorAll("button[data-symbol]")).forEach(function (button) {
      button.addEventListener("click", function () {
        const symbolId = button.getAttribute("data-symbol");
        store.mutate(function (next) {
          next.currentSymbol = symbolId;
          if (["eraser", "blockEraser", "pan"].indexOf(next.currentTool) >= 0) {
            next.currentTool = "brush";
          }
          return true;
        }, { recordHistory: false, reason: "symbol-select" });
        closeDrawersForCompact();
      });
    });
  }

  function renderToolButtons(state) {
    ui.toolButtons.forEach(function (button) {
      const active = button.dataset.tool === state.currentTool;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function renderLegend(state) {
    const rows = getLegendRows(state);
    ui.legendTableBody.innerHTML = rows.length ? rows.map(function (row) {
      return '<tr>' +
        '<td><span class="legend-cell-icon">' + row.svg + '</span></td>' +
        '<td>' + escapeHtml(row.name_ko) + '</td>' +
        '<td>' + escapeHtml(row.abbr) + '</td>' +
        '<td>' + row.count + '</td>' +
        '</tr>';
    }).join("") : '<tr><td colspan="4">아직 사용된 기호가 없습니다.</td></tr>';
  }

  function renderNarrative(state) {
    ui.narrativeOutput.value = generateNarrative(state);
  }

  function renderPatternMiniGrid(cells, size) {
    const pack = getPack(store.getState());
    const rows = Array.isArray(cells) ? cells : [];
    if (!rows.length) {
      return '<div class="pattern-empty">미리보기 없음</div>';
    }
    return '<div class="pattern-mini-grid" style="--pattern-cols:' + rows[0].length + ';--pattern-cell:' + size + 'px">' +
      rows.map(function (row) {
        return row.map(function (cell) {
          const normalized = cellUtils.normalizeCell(cell);
          const bg = normalized.fillColor ? ' style="background:' + escapeHtml(normalized.fillColor) + '"' : "";
          const icon = normalized.symbolId !== "empty" ? pack.createPreviewSvg(normalized.symbolId, Math.max(14, size - 4)) : "";
          return '<div class="pattern-mini-cell"' + bg + '>' + icon + '</div>';
        }).join("");
      }).join("") +
      '</div>';
  }

  function renderStamps(state) {
    if (!state.stamps.length) {
      ui.stampList.innerHTML = '<div class="stamp-item">저장된 패턴이 없습니다.</div>';
      return;
    }
    ui.stampList.innerHTML = state.stamps.map(function (stamp) {
      return '<button class="stamp-item' + (stamp.id === state.currentStampId ? ' active' : '') + '" data-stamp-select="' + stamp.id + '">' +
        '<div class="stamp-item-top"><strong>' + escapeHtml(stamp.name) + '</strong><span>' + stamp.width + ' x ' + stamp.height + '</span></div>' +
        renderPatternMiniGrid(stamp.cells, 18) +
        '</button>';
    }).join("");
    Array.from(ui.stampList.querySelectorAll("[data-stamp-select]")).forEach(function (button) {
      button.addEventListener("click", function () {
        editor.setCurrentStamp(button.getAttribute("data-stamp-select"));
      });
    });
  }

  function renderPatternPicker(state) {
    if (!state.stamps.length) {
      ui.patternPickerList.innerHTML = '<div class="stamp-item">저장된 패턴이 없습니다.</div>';
      ui.patternPreviewBoard.innerHTML = '<div class="pattern-empty">먼저 영역을 저장 패턴으로 만들어 주세요.</div>';
      ui.patternPreviewMeta.textContent = "저장된 패턴이 없습니다.";
      ui.btnPatternApply.disabled = true;
      ui.btnPatternDelete.disabled = true;
      return;
    }

    ui.patternPickerList.innerHTML = state.stamps.map(function (stamp) {
      return '<button class="stamp-item' + (stamp.id === state.currentStampId ? ' active' : '') + '" data-picker-stamp="' + stamp.id + '">' +
        '<div class="stamp-item-top"><strong>' + escapeHtml(stamp.name) + '</strong><span>' + stamp.width + ' x ' + stamp.height + '</span></div>' +
        renderPatternMiniGrid(stamp.cells, 20) +
        '</button>';
    }).join("");

    Array.from(ui.patternPickerList.querySelectorAll("[data-picker-stamp]")).forEach(function (button) {
      button.addEventListener("click", function () {
        editor.setCurrentStamp(button.getAttribute("data-picker-stamp"));
      });
    });

    const currentStamp = state.stamps.find(function (stamp) {
      return stamp.id === state.currentStampId;
    }) || state.stamps[0];

    if (currentStamp && currentStamp.id !== state.currentStampId) {
      editor.setCurrentStamp(currentStamp.id);
      return;
    }

    ui.patternPreviewBoard.innerHTML = currentStamp ? renderPatternMiniGrid(currentStamp.cells, 34) : '<div class="pattern-empty">미리보기 없음</div>';
    ui.patternPreviewMeta.textContent = currentStamp
      ? (currentStamp.name + " · " + currentStamp.width + "칸 x " + currentStamp.height + "칸 · 오른쪽 아래 칸 기준으로 놓입니다.")
      : "저장된 패턴을 선택하세요.";
    ui.btnPatternApply.disabled = !currentStamp;
    ui.btnPatternDelete.disabled = !currentStamp;
  }

  function renderNotes(state) {
    if (!state.notes.length) {
      ui.noteList.innerHTML = '<div class="note-item">메모가 없습니다.</div>';
      return;
    }
    ui.noteList.innerHTML = state.notes.map(function (note, index) {
      return '<div class="note-item">' +
        '<div><strong>#' + (index + 1) + '</strong> ' + (note.row + 1) + '단 / ' + (note.col + 1) + '코</div>' +
        '<div>' + escapeHtml(note.text) + '</div>' +
        '<button data-note-remove="' + note.id + '">삭제</button>' +
        '</div>';
    }).join("");
    Array.from(ui.noteList.querySelectorAll("button[data-note-remove]")).forEach(function (button) {
      button.addEventListener("click", function () {
        editor.removeNote(button.getAttribute("data-note-remove"));
      });
    });
  }

  function renderReadout(state) {
    const direction = window.KnitChartStore.getRowDirection(state, state.currentRow);
    const dirText = direction === "rtl" ? "오른쪽에서 왼쪽" : "왼쪽에서 오른쪽";
    const surface = window.KnitChartStore.getRowSurface(state, state.currentRow);
    const modeLabel = state.chartMode === "flat" ? "평면뜨기" : "원형뜨기";
    ui.rowReadout.textContent = state.currentRow + "단 · " + formatSurfaceLabel(surface) + " · " + dirText + " · " + modeLabel;
  }

  function renderActiveIndicators(state) {
    if (!ui.activeIndicators) {
      return;
    }
    const pack = getPack(state);
    const symbol = pack.getSymbol(state.currentSymbol);
    const tool = getToolDefinition(state.currentTool);
    const currentStamp = state.stamps.find(function (stamp) {
      return stamp.id === state.currentStampId;
    });
    const chips = [
      '<span class="active-pill active-tool">도구: ' + escapeHtml(tool.label || state.currentTool) + '</span>',
      '<span class="active-pill active-symbol"><span class="active-pill-icon">' + pack.createPreviewSvg(symbol.id, 16) + '</span>' + escapeHtml(toolUsesSymbol(state.currentTool) ? ("기호: " + symbol.name_ko) : ("준비 기호: " + symbol.name_ko)) + '</span>',
      '<span class="active-pill active-color"><span class="active-swatch" style="background:' + escapeHtml(state.currentFillColor) + '"></span>' + escapeHtml(toolUsesColor(state.currentTool) ? "칠 색상" : "선택 색상") + '</span>'
    ];
    if (currentStamp) {
      chips.push('<span class="active-pill active-pattern">패턴: ' + escapeHtml(currentStamp.name) + '</span>');
    }
    if (editor.isPasteModeActive()) {
      chips.push('<span class="active-pill active-mode">패턴 놓는 중</span>');
    }
    ui.activeIndicators.innerHTML = chips.join('');
  }

  function renderSelectionGlance(state) {
    if (!ui.selectionGlance) {
      return;
    }
    const pack = getPack(state);
    const symbol = pack.getSymbol(state.currentSymbol);
    const tool = getToolDefinition(state.currentTool);
    const shortcut = getToolShortcut(state.currentTool);
    const toolMeta = shortcut ? ("단축키 " + shortcut) : "도구 선택";
    let title = "지금 그려질 기호";
    let visual = '<span class="selection-visual legend-cell-icon">' + pack.createPreviewSvg(symbol.id, 34) + '</span>';
    let mainLabel = symbol.name_ko;
    let helper = "그리기, 직선, 사각형, 원, 기호 채우기에 이 기호가 들어갑니다.";

    if (toolUsesColor(state.currentTool)) {
      title = "지금 칠해질 색";
      visual = '<span class="selection-visual selection-color-chip"><span class="selection-color-dot" style="background:' + escapeHtml(state.currentFillColor) + '"></span></span>';
      mainLabel = state.currentFillColor.toUpperCase();
      helper = "칠 도구는 기호를 바꾸지 않고 칸 배경만 칠합니다.";
    } else if (!toolUsesSymbol(state.currentTool)) {
      title = "다음에 그릴 기호";
      helper = "다른 도구를 쓰는 중이어도, 그리기/직선/사각형/원으로 바꾸면 이 기호가 사용됩니다.";
    }

    ui.selectionGlance.innerHTML = '' +
      '<div class="selection-card">' +
        '<div class="selection-label">현재 도구</div>' +
        '<div class="selection-main">' +
          '<div class="selection-copy">' +
            '<strong>' + escapeHtml(tool.label || state.currentTool) + '</strong>' +
            '<span>' + escapeHtml(toolMeta) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="selection-card selection-card--visual">' +
        '<div class="selection-label">' + escapeHtml(title) + '</div>' +
        '<div class="selection-main">' +
          visual +
          '<div class="selection-copy">' +
            '<strong>' + escapeHtml(mainLabel) + '</strong>' +
            '<span>' + escapeHtml(helper) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
  }
  function renderInputs(state) {
    ui.gridCols.value = state.cols;
    ui.gridRows.value = state.rows;
    ui.cellSize.value = state.cellSize;
    ui.repeatTimes.value = state.ui.repeatTimes;
    ui.chartMode.value = state.chartMode;
    ui.circularDirection.value = state.circularDirection;
    ui.circularDirection.disabled = state.chartMode !== "circular";
    ui.evenRowHelp.checked = !!state.evenRowInterpretHelp;
    ui.edgeSlipGuide.checked = !!state.edgeSlipGuide;
    ui.showGrid.checked = !!state.view.showGrid;
    ui.showRowNumbers.checked = !!state.view.showRowNumbers;
    ui.showColNumbers.checked = !!state.view.showColNumbers;
    ui.legendInSvg.checked = !!state.view.legendInSvg;
    ui.rowJump.value = state.currentRow;
    ui.rowJump.max = String(state.rows);
    ui.symbolSortMode.value = state.symbolSortMode;
    ui.zoomLabel.textContent = Math.round(state.view.zoom * 100) + "%";
    ui.cellFillColor.value = state.currentFillColor;
    ui.applyFillColor.checked = false;
    ui.shapeFill.checked = !!state.shapeFill;
    ui.eraserSize.value = state.eraserSize;
    ui.btnUndo.disabled = !store.canUndo();
    ui.btnRedo.disabled = !store.canRedo();
    ui.btnFloatUndo.disabled = !store.canUndo();
    ui.btnFloatRedo.disabled = !store.canRedo();
  }
  function renderSymbolSettings(state) {
    const fullOrdered = getOrderedSymbols(state, true);
    const query = ((ui.symbolSettingsSearch && ui.symbolSettingsSearch.value) || "").trim().toLowerCase();
    const ordered = fullOrdered.filter(function (item) {
      return symbolMatchesQuery(item.symbol, query);
    });
    const fullIndexMap = {};
    fullOrdered.forEach(function (item, index) {
      fullIndexMap[item.symbol.id] = index;
    });

    if (!ordered.length) {
      ui.symbolSettingsList.innerHTML = '<div class="symbol-settings-item">검색 결과가 없습니다.</div>';
      return;
    }

    ui.symbolSettingsList.innerHTML = ordered.map(function (item) {
      const fullIndex = fullIndexMap[item.symbol.id];
      const moveDisabled = query.length > 0;
      const usageLabel = item.symbol.id === "empty" ? "배경 전용" : (item.count > 0 ? "사용 " + item.count + "회" : "미사용");
      return '<div class="symbol-settings-item">' +
        '<span class="legend-cell-icon">' + getPack(state).createPreviewSvg(item.symbol.id, 24) + '</span>' +
        '<div class="symbol-settings-meta"><strong>' + escapeHtml(item.symbol.name_ko) + '</strong><span>' + escapeHtml(item.symbol.abbr) + ' · ' + usageLabel + '</span></div>' +
        '<div class="symbol-settings-actions">' +
        '<button data-order-up="' + item.symbol.id + '" ' + (moveDisabled || fullIndex === 0 ? 'disabled' : '') + '>위</button>' +
        '<button data-order-down="' + item.symbol.id + '" ' + (moveDisabled || fullIndex === fullOrdered.length - 1 ? 'disabled' : '') + '>아래</button>' +
        '</div>' +
        '</div>';
    }).join("");

    Array.from(ui.symbolSettingsList.querySelectorAll("button[data-order-up]")).forEach(function (button) {
      button.addEventListener("click", function () {
        const id = button.getAttribute("data-order-up");
        store.mutate(function (next) {
          next.customSymbolOrder = moveOrder(next.customSymbolOrder, id, "up");
          next.symbolSortMode = "custom";
          return true;
        }, { recordHistory: false, reason: "symbol-order" });
      });
    });

    Array.from(ui.symbolSettingsList.querySelectorAll("button[data-order-down]")).forEach(function (button) {
      button.addEventListener("click", function () {
        const id = button.getAttribute("data-order-down");
        store.mutate(function (next) {
          next.customSymbolOrder = moveOrder(next.customSymbolOrder, id, "down");
          next.symbolSortMode = "custom";
          return true;
        }, { recordHistory: false, reason: "symbol-order" });
      });
    });
  }

  function getEdgeSlipHint(state) {
    if (!state.edgeSlipGuide) {
      return "";
    }
    const row = state.grid[state.currentRow - 1] || [];
    let first = null;
    let last = null;
    for (let i = 0; i < row.length; i += 1) {
      const id = cellUtils.symbolIdOf(row[i]);
      if (id !== "empty" && id !== "noStitch") {
        first = id;
        break;
      }
    }
    for (let i = row.length - 1; i >= 0; i -= 1) {
      const id = cellUtils.symbolIdOf(row[i]);
      if (id !== "empty" && id !== "noStitch") {
        last = id;
        break;
      }
    }
    if (first === "sl" || last === "sl") {
      return "가장자리 걸러뜨기 안내: 이 단의 가장자리에 걸러뜨기 기호가 있습니다.";
    }
    return "";
  }

  function renderStatus(state) {
    const symbol = getPack(state).getSymbol(state.currentSymbol);
    const tool = getToolDefinition(state.currentTool);
    ui.cursorLine.textContent = "현재 칸: " + (state.cursor.row + 1) + "단 / " + (state.cursor.col + 1) + "코";
    let line = "현재 도구: " + (tool.label || state.currentTool);
    if (toolUsesSymbol(state.currentTool)) {
      line += " | 현재 기호: " + symbol.name_ko;
    } else {
      line += " | 준비 기호: " + symbol.name_ko;
    }
    line += " | 선택 색상: " + state.currentFillColor;
    if (editor.isPasteModeActive()) {
      line += " | 패턴을 놓을 칸을 정하세요. 저장 패턴의 오른쪽 아래 칸이 기준입니다";
    }
    if (state.chartMode === "flat" && state.evenRowInterpretHelp && state.currentRow % 2 === 0) {
      line += " | 짝수단 도움말 켜짐";
    }
    if (state.selection) {
      const bounds = editor.getSelectionBounds();
      line += " | 선택 영역 " + bounds.width + " x " + bounds.height;
    }
    const edgeHint = getEdgeSlipHint(state);
    if (edgeHint) {
      line += " | " + edgeHint;
    }
    setStatus(line);
    ui.btnPatternPasteMode.classList.toggle("active", editor.isPasteModeActive());
    ui.btnCancelPaste.disabled = !editor.isPasteModeActive();
  }
  function scheduleAutosave(state) {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
    }
    autosaveTimer = setTimeout(function () {
      saveAutosavedState(state);
    }, 220);
  }

  function refreshUI(state, skipAutosave) {
    renderSymbolPalette(state);
    renderToolButtons(state);
    renderLegend(state);
    renderNarrative(state);
    renderStamps(state);
    renderPatternPicker(state);
    renderNotes(state);
    renderReadout(state);
    renderActiveIndicators(state);
    renderSelectionGlance(state);
    renderInputs(state);
    renderSymbolSettings(state);
    renderStatus(state);
    syncFeedbackState(state);
    if (!skipAutosave) {
      scheduleAutosave(state);
    }
  }

  function saveSelectionPattern(customName) {
    const name = (customName || ui.stampName.value || "저장 패턴").trim();
    if (!editor.saveSelectionAsStamp(name)) {
      setStatus("저장할 선택 영역이 없습니다.");
      showToast("먼저 저장할 영역을 선택해 주세요.", "warn");
      return false;
    }
    ui.stampName.value = "";
    setStatus('패턴 "' + name + '" 저장 완료');
    showToast('패턴 "' + name + '"을 저장했습니다.', "success");
    return true;
  }
  function openPatternPicker() {
    const state = store.getState();
    if (!state.stamps.length) {
      setStatus("먼저 선택 영역을 패턴으로 저장해 주세요.");
      showToast("저장된 패턴이 없습니다. 영역을 먼저 저장해 주세요.", "warn");
      return false;
    }
    if (!state.currentStampId && state.stamps[0]) {
      editor.setCurrentStamp(state.stamps[0].id);
    }
    setOverlay("pattern");
    showToast("패턴 목록을 열었습니다.", "info");
    return true;
  }
  function startSelectedPatternPlacement() {
    const state = store.getState();
    if (!state.currentStampId) {
      showToast("먼저 패턴을 하나 선택해 주세요.", "warn");
      return false;
    }
    if (!editor.startPatternPaste(state.currentStampId)) {
      setStatus("놓을 패턴을 찾지 못했습니다.");
      showToast("선택한 패턴을 찾지 못했습니다.", "warn");
      return false;
    }
    setOverlay(null);
    showToast("패턴 놓기 준비가 됐습니다. 놓을 칸을 눌러 주세요.", "success");
    return true;
  }
  function bindEvents() {
    ui.toolButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        store.mutate(function (state) {
          state.currentTool = button.dataset.tool;
          return true;
        }, { recordHistory: false, reason: "tool-select" });
        closeDrawersForCompact();
      });
    });

    [ui.symbolSearch, ui.symbolSettingsSearch].filter(Boolean).forEach(function (input) {
      input.addEventListener("input", function () {
        refreshUI(store.getState(), true);
      });
    });

    ui.scrim.addEventListener("click", function () { setOverlay(null); });
    ui.btnCloseLeftPanel.addEventListener("click", function () { setOverlay(null); });
    ui.btnCloseRightPanel.addEventListener("click", function () { setOverlay(null); });
    ui.btnCloseSettings.addEventListener("click", function () { setOverlay(null); });
    ui.btnClosePatternScreen.addEventListener("click", function () { setOverlay(null); });
    ui.btnOpenLeft.addEventListener("click", function () { openLeft("section-symbols"); });
    ui.btnOpenRight.addEventListener("click", function () { openRight("section-chart-size"); });
    ui.btnOpenSettings.addEventListener("click", function () { setOverlay("settings"); });
    ui.btnMobileSymbols.addEventListener("click", function () { openLeft("section-symbols"); });
    ui.btnMobileNavSymbols.addEventListener("click", function () { openLeft("section-symbols"); });
    ui.btnMobileTools.addEventListener("click", function () { openRight("section-chart-size"); });
    ui.btnMobileInspect.addEventListener("click", function () { setOverlay("settings"); });
    [ui.btnMobileSettings].filter(Boolean).forEach(function (button) {
      button.addEventListener("click", function () {
        window.KnitChartExportJson.download(store.getState());
        showToast("차트 JSON 파일을 저장했습니다.", "success");
      });
    });
    ui.btnNew.addEventListener("click", function () {
      if (!window.confirm("새 차트를 만들까요? 현재 상태는 자동 저장되지만 화면은 초기화됩니다.")) {
        return;
      }
      const fresh = window.KnitChartStore.createInitialState({ rows: 24, cols: 24 });
      store.replace(fresh, { recordHistory: false, reason: "new-chart" });
      store.clearHistory();
      editor.cancelPasteMode();
      editor.resetView();
      setOverlay(null);
    });

    ui.btnSaveJson.addEventListener("click", function () {
      window.KnitChartExportJson.download(store.getState());
      showToast("차트 JSON 파일을 저장했습니다.", "success");
    });
    ui.btnLoadJson.addEventListener("click", function () {
      ui.inputLoadJson.click();
    });
    ui.inputLoadJson.addEventListener("change", async function (event) {
      const file = event.target.files && event.target.files[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      try {
        const loaded = await window.KnitChartImportJson.importFromFile(file);
        store.replace(loaded, { recordHistory: false, reason: "json-load" });
        store.clearHistory();
        editor.cancelPasteMode();
        editor.resetView();
        setOverlay(null);
      } catch (error) {
        window.alert("JSON 불러오기 실패: " + error.message);
      }
    });

    ui.btnExportSvg.addEventListener("click", function () {
      const state = store.getState();
      window.KnitChartExportSvg.downloadSvg(state, { includeLegend: state.view.legendInSvg });
    });
    ui.btnExportPng.addEventListener("click", async function () {
      try {
        const state = store.getState();
        await window.KnitChartExportPng.downloadPng(state, { includeLegend: state.view.legendInSvg });
      } catch (error) {
        window.alert("PNG 내보내기 실패: " + error.message);
      }
    });
    ui.btnPrint.addEventListener("click", function () { window.print(); });

    [ui.btnUndo, ui.btnFloatUndo].forEach(function (button) {
      button.addEventListener("click", function () { store.undo(); });
    });
    [ui.btnRedo, ui.btnFloatRedo].forEach(function (button) {
      button.addEventListener("click", function () { store.redo(); });
    });

    ui.btnZoomOut.addEventListener("click", function () { editor.setZoom(store.getState().view.zoom * 0.88); });
    ui.btnZoomIn.addEventListener("click", function () { editor.setZoom(store.getState().view.zoom * 1.12); });
    ui.btnZoomReset.addEventListener("click", function () { editor.resetView(); });

    [ui.btnSavePattern, ui.btnSaveStamp, ui.btnMobileSavePattern].filter(Boolean).forEach(function (button) {
      button.addEventListener("click", function () {
        saveSelectionPattern();
      });
    });

    [ui.btnOpenPatternScreen, ui.btnMobilePatternScreen].filter(Boolean).forEach(function (button) {
      button.addEventListener("click", function () {
        openPatternPicker();
      });
    });

    [ui.btnMobileNavCheck].filter(Boolean).forEach(function (button) {
      button.addEventListener("click", function () {
        saveSelectionPattern();
      });
    });

    [ui.btnMobileNavSettings].filter(Boolean).forEach(function (button) {
      button.addEventListener("click", function () {
        openPatternPicker();
      });
    });
    ui.btnPatternPasteMode.addEventListener("click", function () {
      if (!startSelectedPatternPlacement()) {
        openPatternPicker();
      }
    });
    ui.btnPatternApply.addEventListener("click", function () {
      if (!startSelectedPatternPlacement()) {
        openPatternPicker();
      }
    });
    ui.btnCancelPaste.addEventListener("click", function () { editor.cancelPasteMode(); });

    ui.btnPatternDelete.addEventListener("click", function () {
      const state = store.getState();
      const currentStampId = state.currentStampId;
      const currentStamp = state.stamps.find(function (stamp) {
        return stamp.id === currentStampId;
      });
      if (!currentStampId || !currentStamp) {
        setStatus("삭제할 저장 패턴이 선택되지 않았습니다.");
        showToast("삭제할 패턴을 먼저 선택해 주세요.", "warn");
        return;
      }
      if (editor.deleteStamp(currentStampId)) {
        showToast('패턴 "' + currentStamp.name + '"을 삭제했습니다.', "info");
      }
    });
    ui.btnDeleteStamp.addEventListener("click", function () {
      const state = store.getState();
      const currentStampId = state.currentStampId;
      const currentStamp = state.stamps.find(function (stamp) {
        return stamp.id === currentStampId;
      });
      if (!currentStampId || !currentStamp) {
        setStatus("삭제할 저장 패턴이 선택되지 않았습니다.");
        showToast("삭제할 패턴을 먼저 선택해 주세요.", "warn");
        return;
      }
      if (editor.deleteStamp(currentStampId)) {
        showToast('패턴 "' + currentStamp.name + '"을 삭제했습니다.', "info");
      }
    });
    ui.btnMirrorH.addEventListener("click", function () {
      if (!editor.mirrorSelection("horizontal")) {
        setStatus("좌우로 뒤집을 선택 영역이 없습니다.");
      }
    });
    ui.btnMirrorV.addEventListener("click", function () {
      if (!editor.mirrorSelection("vertical")) {
        setStatus("상하로 뒤집을 선택 영역이 없습니다.");
      }
    });
    ui.btnSelectionClear.addEventListener("click", function () { editor.clearSelection(); });

    ui.repeatTimes.addEventListener("change", function () {
      store.mutate(function (state) {
        state.ui.repeatTimes = clamp(Number(ui.repeatTimes.value) || 2, 2, 999);
        return true;
      }, { recordHistory: false, reason: "repeat-times" });
    });
    ui.btnAddRepeat.addEventListener("click", function () {
      if (!editor.createRepeatBoxFromSelection(ui.repeatTimes.value)) {
        setStatus("반복 표시를 만들 선택 영역이 없습니다.");
      }
    });

    ui.btnRowInsert.addEventListener("click", function () { editor.insertRows(ui.rowIndex.value, ui.rowCount.value); });
    ui.btnRowDelete.addEventListener("click", function () { editor.deleteRows(ui.rowIndex.value, ui.rowCount.value); });
    ui.btnColInsert.addEventListener("click", function () { editor.insertCols(ui.colIndex.value, ui.colCount.value); });
    ui.btnColDelete.addEventListener("click", function () { editor.deleteCols(ui.colIndex.value, ui.colCount.value); });

    ui.btnApplyGrid.addEventListener("click", function () {
      const rows = Number(ui.gridRows.value) || 1;
      const cols = Number(ui.gridCols.value) || 1;
      const cellSize = clamp(Number(ui.cellSize.value) || 28, 16, 64);
      store.mutate(function (state) {
        resizeGridKeepData(state, rows, cols);
        state.cellSize = cellSize;
        return true;
      }, { recordHistory: true, reason: "grid-resize" });
      editor.resetView();
    });

    ui.chartMode.addEventListener("change", function () {
      store.mutate(function (state) {
        state.chartMode = ui.chartMode.value === "circular" ? "circular" : "flat";
        return true;
      }, { recordHistory: false, reason: "mode" });
    });
    ui.circularDirection.addEventListener("change", function () {
      store.mutate(function (state) {
        state.circularDirection = ui.circularDirection.value === "ltr" ? "ltr" : "rtl";
        return true;
      }, { recordHistory: false, reason: "circular-direction" });
    });
    ui.evenRowHelp.addEventListener("change", function () {
      store.mutate(function (state) {
        state.evenRowInterpretHelp = ui.evenRowHelp.checked;
        return true;
      }, { recordHistory: false, reason: "even-help" });
    });
    ui.edgeSlipGuide.addEventListener("change", function () {
      store.mutate(function (state) {
        state.edgeSlipGuide = ui.edgeSlipGuide.checked;
        return true;
      }, { recordHistory: false, reason: "edge-slip" });
    });
    ui.showGrid.addEventListener("change", function () {
      store.mutate(function (state) {
        state.view.showGrid = ui.showGrid.checked;
        return true;
      }, { recordHistory: false, reason: "show-grid" });
    });
    ui.showRowNumbers.addEventListener("change", function () {
      store.mutate(function (state) {
        state.view.showRowNumbers = ui.showRowNumbers.checked;
        return true;
      }, { recordHistory: false, reason: "show-row-numbers" });
    });
    ui.showColNumbers.addEventListener("change", function () {
      store.mutate(function (state) {
        state.view.showColNumbers = ui.showColNumbers.checked;
        return true;
      }, { recordHistory: false, reason: "show-col-numbers" });
    });
    ui.legendInSvg.addEventListener("change", function () {
      store.mutate(function (state) {
        state.view.legendInSvg = ui.legendInSvg.checked;
        return true;
      }, { recordHistory: false, reason: "legend-in-svg" });
    });
    ui.btnRowJump.addEventListener("click", function () { editor.jumpToRow(ui.rowJump.value); });

    ui.cellFillColor.addEventListener("input", function () {
      store.mutate(function (state) {
        state.currentFillColor = ui.cellFillColor.value;
        return true;
      }, { recordHistory: false, reason: "fill-color" });
    });
    ui.btnClearFillColor.addEventListener("click", function () {
      store.mutate(function (state) {
        state.currentFillColor = "#ffffff";
        return true;
      }, { recordHistory: false, reason: "fill-clear" });
    });
    ui.applyFillColor.addEventListener("change", function () {
      store.mutate(function (state) {
        state.applyFillColor = ui.applyFillColor.checked;
        return true;
      }, { recordHistory: false, reason: "apply-fill-color" });
    });
    ui.shapeFill.addEventListener("change", function () {
      store.mutate(function (state) {
        state.shapeFill = ui.shapeFill.checked;
        return true;
      }, { recordHistory: false, reason: "shape-fill" });
    });
    ui.eraserSize.addEventListener("change", function () {
      store.mutate(function (state) {
        state.eraserSize = clamp(Number(ui.eraserSize.value) || 3, 2, 12);
        return true;
      }, { recordHistory: false, reason: "eraser-size" });
    });

    ui.symbolSortMode.addEventListener("change", function () {
      store.mutate(function (state) {
        state.symbolSortMode = ui.symbolSortMode.value;
        return true;
      }, { recordHistory: false, reason: "symbol-sort-mode" });
    });
    ui.btnResetSymbolOrder.addEventListener("click", function () {
      store.mutate(function (state) {
        state.customSymbolOrder = getPack(state).defaultOrder();
        state.symbolSortMode = "usage";
        return true;
      }, { recordHistory: false, reason: "symbol-order-reset" });
    });

    window.addEventListener("knitchart:toggle-symbol-drawer", function () {
      if (ui.body.classList.contains("show-left-panel")) {
        setOverlay(null);
      } else {
        openLeft("section-symbols");
      }
    });
    window.addEventListener("knitchart:save-json", function () {
      window.KnitChartExportJson.download(store.getState());
      showToast("차트 JSON 파일을 저장했습니다.", "success");
    });
    window.addEventListener("knitchart:save-pattern", function () {
      saveSelectionPattern();
    });
    window.addEventListener("knitchart:open-pattern-picker", function () {
      openPatternPicker();
    });
  }

  editor.setOnTransientChange(function (state) {
    refreshUI(state, true);
  });

  bindInteractionFeedback();
  installShortcutBadges();
  bindEvents();
  store.subscribe(function (state) {
    refreshUI(state, false);
  });
  refreshUI(store.getState(), false);
})();












