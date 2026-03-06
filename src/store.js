(function () {
  const cellUtils = window.KnitChartCells;

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function createGrid(rows, cols) {
    const grid = [];
    for (let r = 0; r < rows; r += 1) {
      const row = [];
      for (let c = 0; c < cols; c += 1) {
        row.push(cellUtils.createCell("empty", ""));
      }
      grid.push(row);
    }
    return grid;
  }

  function getRowDirection(state, rowNumber) {
    if (state.chartMode === "circular") {
      return state.circularDirection || "rtl";
    }
    return rowNumber % 2 === 1 ? "rtl" : "ltr";
  }

  function getRowSurface(state, rowNumber) {
    if (state.chartMode === "circular") {
      return "RS";
    }
    return rowNumber % 2 === 1 ? "RS" : "WS";
  }

  function normalizePattern(pattern) {
    const item = pattern && typeof pattern === "object" ? pattern : {};
    const width = clamp(Number(item.width) || 1, 1, 400);
    const height = clamp(Number(item.height) || 1, 1, 400);
    return {
      id: item.id || ("stamp_" + Date.now() + "_" + Math.floor(Math.random() * 100000)),
      name: String(item.name || "저장 패턴"),
      width: width,
      height: height,
      cells: cellUtils.normalizeGrid(item.cells, height, width),
    };
  }

  function normalizeClipboard(clipboard) {
    if (!clipboard || typeof clipboard !== "object") {
      return null;
    }
    const width = clamp(Number(clipboard.width) || 1, 1, 400);
    const height = clamp(Number(clipboard.height) || 1, 1, 400);
    return {
      width: width,
      height: height,
      cells: cellUtils.normalizeGrid(clipboard.cells, height, width),
    };
  }

  function createInitialState(options) {
    const pack = window.KnitChartSymbols.getPack("KO_KNIT");
    const rows = (options && options.rows) || 24;
    const cols = (options && options.cols) || 24;
    return {
      appVersion: "2.1.0",
      packId: "KO_KNIT",
      title: "새 대바늘 차트",
      rows: rows,
      cols: cols,
      cellSize: 28,
      grid: createGrid(rows, cols),
      currentTool: "brush",
      currentSymbol: "knit",
      currentFillColor: "#dbeafe",
      applyFillColor: false,
      shapeFill: true,
      eraserSize: 3,
      currentStampId: null,
      selection: null,
      clipboard: null,
      repeatBoxes: [],
      notes: [],
      stamps: [],
      cursor: { row: 0, col: 0 },
      currentRow: 1,
      chartMode: "flat",
      circularDirection: "rtl",
      evenRowInterpretHelp: true,
      edgeSlipGuide: false,
      symbolSortMode: "usage",
      customSymbolOrder: pack.defaultOrder(),
      view: {
        zoom: 1,
        panX: 72,
        panY: 48,
        showGrid: true,
        showRowNumbers: true,
        showColNumbers: true,
        legendInSvg: true,
      },
      ui: {
        repeatTimes: 2,
        activeMobilePanel: null,
        settingsOpen: false,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  function ensureCustomOrder(state) {
    const pack = window.KnitChartSymbols.getPack(state.packId || "KO_KNIT");
    const ids = pack.defaultOrder();
    const existing = Array.isArray(state.customSymbolOrder) ? state.customSymbolOrder.slice() : [];
    const seen = {};
    const next = [];

    existing.forEach(function (id) {
      if (!seen[id] && ids.indexOf(id) >= 0) {
        seen[id] = true;
        next.push(id);
      }
    });

    ids.forEach(function (id) {
      if (!seen[id]) {
        next.push(id);
      }
    });

    state.customSymbolOrder = next;
  }

  function normalizeImportedState(raw) {
    const fallback = createInitialState();
    if (!raw || typeof raw !== "object") {
      return fallback;
    }

    const state = deepClone(raw);
    state.packId = "KO_KNIT";
    state.title = state.title || fallback.title;
    state.rows = clamp(Number(state.rows) || fallback.rows, 1, 400);
    state.cols = clamp(Number(state.cols) || fallback.cols, 1, 400);
    state.cellSize = clamp(Number(state.cellSize) || fallback.cellSize, 16, 64);
    state.grid = cellUtils.normalizeGrid(state.grid, state.rows, state.cols);

    state.currentTool = state.currentTool || fallback.currentTool;
    state.currentSymbol = state.currentSymbol || fallback.currentSymbol;
    state.currentFillColor = /^#[0-9a-fA-F]{6}$/.test(String(state.currentFillColor || "")) ? String(state.currentFillColor) : fallback.currentFillColor;
    state.applyFillColor = !!state.applyFillColor;
    state.shapeFill = state.shapeFill !== false;
    state.eraserSize = clamp(Number(state.eraserSize) || fallback.eraserSize, 2, 12);
    state.currentStampId = state.currentStampId || null;
    state.selection = state.selection || null;
    state.clipboard = normalizeClipboard(state.clipboard);
    state.repeatBoxes = Array.isArray(state.repeatBoxes) ? state.repeatBoxes : [];
    state.notes = Array.isArray(state.notes) ? state.notes : [];
    state.stamps = Array.isArray(state.stamps) ? state.stamps.map(normalizePattern) : [];
    state.cursor = state.cursor && typeof state.cursor === "object" ? state.cursor : deepClone(fallback.cursor);
    state.cursor.row = clamp(Number(state.cursor.row) || 0, 0, state.rows - 1);
    state.cursor.col = clamp(Number(state.cursor.col) || 0, 0, state.cols - 1);
    state.currentRow = clamp(Number(state.currentRow) || 1, 1, state.rows);

    state.chartMode = state.chartMode === "circular" ? "circular" : "flat";
    state.circularDirection = state.circularDirection === "ltr" ? "ltr" : "rtl";
    state.evenRowInterpretHelp = state.evenRowInterpretHelp !== false;
    state.edgeSlipGuide = !!state.edgeSlipGuide;
    state.symbolSortMode = ["usage", "custom", "name"].indexOf(state.symbolSortMode) >= 0 ? state.symbolSortMode : "usage";

    state.view = state.view && typeof state.view === "object" ? state.view : {};
    state.view.zoom = clamp(Number(state.view.zoom) || 1, 0.25, 5);
    state.view.panX = Number.isFinite(Number(state.view.panX)) ? Number(state.view.panX) : fallback.view.panX;
    state.view.panY = Number.isFinite(Number(state.view.panY)) ? Number(state.view.panY) : fallback.view.panY;
    state.view.showGrid = state.view.showGrid !== false;
    state.view.showRowNumbers = state.view.showRowNumbers !== false;
    state.view.showColNumbers = state.view.showColNumbers !== false;
    state.view.legendInSvg = state.view.legendInSvg !== false;

    state.ui = state.ui && typeof state.ui === "object" ? state.ui : {};
    state.ui.repeatTimes = clamp(Number(state.ui.repeatTimes) || 2, 2, 999);
    state.ui.activeMobilePanel = ["left", "right", null].indexOf(state.ui.activeMobilePanel) >= 0 ? state.ui.activeMobilePanel : null;
    state.ui.settingsOpen = !!state.ui.settingsOpen;

    ensureCustomOrder(state);
    if (!state.stamps.some(function (item) { return item.id === state.currentStampId; })) {
      state.currentStampId = state.stamps.length ? state.stamps[0].id : null;
    }

    state.updatedAt = Date.now();
    state.createdAt = state.createdAt || Date.now();
    return state;
  }

  function createStore(initialState) {
    let state = deepClone(initialState);
    const listeners = [];
    const history = {
      past: [],
      future: [],
      limit: 160,
    };

    function emit(reason) {
      listeners.forEach(function (listener) {
        listener(state, reason || "update", history);
      });
    }

    function snapshot() {
      return deepClone(state);
    }

    function pushHistory(previous) {
      history.past.push(previous);
      if (history.past.length > history.limit) {
        history.past.shift();
      }
      history.future = [];
    }

    function mutate(mutator, options) {
      const opts = options || {};
      const recordHistory = opts.recordHistory !== false;
      const previous = recordHistory ? snapshot() : null;
      const changed = mutator(state) !== false;
      if (!changed) {
        return false;
      }
      ensureCustomOrder(state);
      state.updatedAt = Date.now();
      if (recordHistory) {
        pushHistory(previous);
      }
      emit(opts.reason || "mutate");
      return true;
    }

    function replace(nextState, options) {
      const opts = options || {};
      const recordHistory = opts.recordHistory !== false;
      if (recordHistory) {
        pushHistory(snapshot());
      }
      state = normalizeImportedState(nextState);
      emit(opts.reason || "replace");
      return true;
    }

    function undo() {
      if (!history.past.length) {
        return false;
      }
      history.future.push(snapshot());
      state = history.past.pop();
      emit("undo");
      return true;
    }

    function redo() {
      if (!history.future.length) {
        return false;
      }
      history.past.push(snapshot());
      state = history.future.pop();
      emit("redo");
      return true;
    }

    function clearHistory() {
      history.past = [];
      history.future = [];
      emit("history-clear");
    }

    return {
      getState: function () {
        return state;
      },
      mutate: mutate,
      replace: replace,
      undo: undo,
      redo: redo,
      canUndo: function () {
        return history.past.length > 0;
      },
      canRedo: function () {
        return history.future.length > 0;
      },
      clearHistory: clearHistory,
      subscribe: function (listener) {
        listeners.push(listener);
        return function () {
          const index = listeners.indexOf(listener);
          if (index >= 0) {
            listeners.splice(index, 1);
          }
        };
      },
      history: history,
    };
  }

  window.KnitChartStore = {
    deepClone: deepClone,
    clamp: clamp,
    createGrid: createGrid,
    createInitialState: createInitialState,
    normalizeImportedState: normalizeImportedState,
    normalizePattern: normalizePattern,
    normalizeClipboard: normalizeClipboard,
    createStore: createStore,
    getRowDirection: getRowDirection,
    getRowSurface: getRowSurface,
    ensureCustomOrder: ensureCustomOrder,
  };
})();
