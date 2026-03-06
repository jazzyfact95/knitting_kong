(function () {
  const utils = window.KnitChartStore;
  const cellUtils = window.KnitChartCells;

  function getSelectionBounds(selection) {
    if (!selection) {
      return null;
    }
    const rowMin = Math.min(selection.rowStart, selection.rowEnd);
    const rowMax = Math.max(selection.rowStart, selection.rowEnd);
    const colMin = Math.min(selection.colStart, selection.colEnd);
    const colMax = Math.max(selection.colStart, selection.colEnd);
    return {
      rowMin: rowMin,
      rowMax: rowMax,
      colMin: colMin,
      colMax: colMax,
      width: colMax - colMin + 1,
      height: rowMax - rowMin + 1,
    };
  }

  function drawRoundRect(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function cloneRect(rect) {
    return rect ? {
      rowStart: rect.rowStart,
      rowEnd: rect.rowEnd,
      colStart: rect.colStart,
      colEnd: rect.colEnd,
    } : null;
  }

  function cloneCells(rows) {
    return rows.map(function (row) {
      return row.map(function (cell) {
        return cellUtils.cloneCell(cell);
      });
    });
  }

  function makeEmptyCells(count) {
    const row = [];
    for (let i = 0; i < count; i += 1) {
      row.push(cellUtils.createCell("empty", ""));
    }
    return row;
  }

  function uniquePoints(points) {
    const seen = {};
    return (points || []).filter(function (point) {
      if (!point) {
        return false;
      }
      const key = point.row + ":" + point.col;
      if (seen[key]) {
        return false;
      }
      seen[key] = true;
      return true;
    });
  }

  function hexToRgba(hex, alpha) {
    const safe = /^#[0-9a-fA-F]{6}$/.test(String(hex || "")) ? String(hex) : "#93c5fd";
    const value = safe.slice(1);
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
  }

  function adjustRepeatBoxesOnInsertRows(boxes, idx, count) {
    boxes.forEach(function (box) {
      if (box.rowStart >= idx) {
        box.rowStart += count;
        box.rowEnd += count;
      } else if (box.rowEnd >= idx) {
        box.rowEnd += count;
      }
    });
  }

  function adjustRepeatBoxesOnDeleteRows(boxes, idx, count) {
    return boxes.map(function (box) {
      const next = Object.assign({}, box);
      if (next.rowStart >= idx + count) {
        next.rowStart -= count;
        next.rowEnd -= count;
        return next;
      }
      if (next.rowEnd < idx) {
        return next;
      }
      next.rowStart = Math.max(0, Math.min(next.rowStart, idx - 1));
      next.rowEnd = Math.max(0, next.rowEnd - count);
      if (next.rowStart > next.rowEnd) {
        return null;
      }
      return next;
    }).filter(Boolean);
  }

  function adjustRepeatBoxesOnInsertCols(boxes, idx, count) {
    boxes.forEach(function (box) {
      if (box.colStart >= idx) {
        box.colStart += count;
        box.colEnd += count;
      } else if (box.colEnd >= idx) {
        box.colEnd += count;
      }
    });
  }

  function adjustRepeatBoxesOnDeleteCols(boxes, idx, count) {
    return boxes.map(function (box) {
      const next = Object.assign({}, box);
      if (next.colStart >= idx + count) {
        next.colStart -= count;
        next.colEnd -= count;
        return next;
      }
      if (next.colEnd < idx) {
        return next;
      }
      next.colStart = Math.max(0, Math.min(next.colStart, idx - 1));
      next.colEnd = Math.max(0, next.colEnd - count);
      if (next.colStart > next.colEnd) {
        return null;
      }
      return next;
    }).filter(Boolean);
  }

  function createEditorCanvas(canvas, store) {
    const ctx = canvas.getContext("2d");
    const tools = window.KnitChartTools || {};

    const editor = {
      canvas: canvas,
      ctx: ctx,
      store: store,
      host: canvas.parentElement || canvas,
      dpr: window.devicePixelRatio || 1,
      activePointerId: null,
      resizeObserver: null,
      margin: { left: 60, top: 52 },
      pointerDown: false,
      isPanning: false,
      panStart: { x: 0, y: 0, panX: 0, panY: 0 },
      batchActive: false,
      batchHasMutated: false,
      onTransientChange: null,
      transient: {
        hoverCell: null,
        pasteMode: false,
        pasteAnchor: null,
        lastTouchPasteAnchor: null,
        shapePreview: null,
      },
      keyboard: { spacePressed: false },

      getState: function () {
        return this.store.getState();
      },

      getCellData: function (row, col, state) {
        const nextState = state || this.getState();
        if (row < 0 || row >= nextState.rows || col < 0 || col >= nextState.cols) {
          return cellUtils.createCell("empty", "");
        }
        return cellUtils.normalizeCell(nextState.grid[row][col]);
      },

      getStampById: function (state, id) {
        const nextState = state || this.getState();
        const targetId = id || nextState.currentStampId;
        if (!targetId) {
          return null;
        }
        return nextState.stamps.find(function (item) {
          return item.id === targetId;
        }) || null;
      },

      notifyTransientChange: function () {
        if (typeof this.onTransientChange === "function") {
          this.onTransientChange(this.getState(), this.transient);
        }
        this.render();
      },

      setOnTransientChange: function (listener) {
        this.onTransientChange = listener;
      },

      isPasteModeActive: function () {
        return !!this.transient.pasteMode;
      },

      beginBatch: function () {
        this.batchActive = true;
        this.batchHasMutated = false;
      },

      endBatch: function () {
        this.batchActive = false;
        this.batchHasMutated = false;
      },

      applyMutation: function (mutator, reason) {
        const recordHistory = this.batchActive ? !this.batchHasMutated : true;
        const changed = this.store.mutate(mutator, {
          recordHistory: recordHistory,
          reason: reason || "editor",
        });
        if (changed && this.batchActive) {
          this.batchHasMutated = true;
        }
        return changed;
      },

      cellToWorld: function (row, col, state) {
        const s = state || this.getState();
        const displayRow = s.rows - 1 - row;
        return {
          x: this.margin.left + col * s.cellSize,
          y: this.margin.top + displayRow * s.cellSize,
        };
      },

      worldToCell: function (worldX, worldY) {
        const state = this.getState();
        const col = Math.floor((worldX - this.margin.left) / state.cellSize);
        const displayRow = Math.floor((worldY - this.margin.top) / state.cellSize);
        if (col < 0 || col >= state.cols || displayRow < 0 || displayRow >= state.rows) {
          return null;
        }
        return {
          row: state.rows - 1 - displayRow,
          col: col,
        };
      },

      screenToWorld: function (screenX, screenY) {
        const state = this.getState();
        return {
          x: (screenX - state.view.panX) / state.view.zoom,
          y: (screenY - state.view.panY) / state.view.zoom,
        };
      },

      getViewportSize: function () {
        const rect = (this.host || this.canvas).getBoundingClientRect();
        return {
          width: Math.max(1, Math.floor(rect.width)),
          height: Math.max(1, Math.floor(rect.height)),
        };
      },

      fitChartToViewport: function () {
        const viewport = this.getViewportSize();
        return this.store.mutate(function (state) {
          const chartWidth = 60 + state.cols * state.cellSize + 28;
          const chartHeight = 52 + state.rows * state.cellSize + 72;
          const padding = 24;
          const zoom = utils.clamp(Math.min(
            (viewport.width - padding * 2) / chartWidth,
            (viewport.height - padding * 2) / chartHeight,
            1.6
          ), 0.25, 4);
          state.view.zoom = zoom;
          state.view.panX = Math.round((viewport.width - chartWidth * zoom) / 2);
          state.view.panY = Math.round((viewport.height - chartHeight * zoom) / 2);
          return true;
        }, { recordHistory: false, reason: "fit-view" });
      },
      eventToCell: function (event) {
        const rect = this.canvas.getBoundingClientRect();
        const world = this.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
        return this.worldToCell(world.x, world.y);
      },

      setHoverCell: function (cell) {
        const prev = this.transient.hoverCell;
        const same = prev && cell && prev.row === cell.row && prev.col === cell.col;
        if ((prev == null && cell == null) || same) {
          return;
        }
        this.transient.hoverCell = cell;
        if (this.transient.pasteMode && cell) {
          this.transient.pasteAnchor = { row: cell.row, col: cell.col };
        }
        this.notifyTransientChange();
      },

      setShapePreview: function (points, label) {
        this.transient.shapePreview = {
          cells: uniquePoints(points),
          label: label || "도형 미리보기",
        };
        this.notifyTransientChange();
      },

      clearShapePreview: function () {
        if (!this.transient.shapePreview) {
          return false;
        }
        this.transient.shapePreview = null;
        this.notifyTransientChange();
        return true;
      },

      startPasteMode: function () {
        const state = this.getState();
        if (!state.clipboard) {
          return false;
        }
        this.transient.pasteMode = true;
        this.transient.pasteAnchor = this.transient.hoverCell || { row: state.cursor.row, col: state.cursor.col };
        this.transient.lastTouchPasteAnchor = null;
        this.notifyTransientChange();
        return true;
      },

      cancelPasteMode: function () {
        if (!this.transient.pasteMode) {
          return false;
        }
        this.transient.pasteMode = false;
        this.transient.pasteAnchor = null;
        this.transient.lastTouchPasteAnchor = null;
        this.notifyTransientChange();
        return true;
      },

      setClipboardFromStamp: function (stampId) {
        const targetId = stampId || this.getState().currentStampId;
        return this.store.mutate(function (state) {
          const stamp = state.stamps.find(function (item) {
            return item.id === targetId;
          });
          if (!stamp) {
            return false;
          }
          state.currentStampId = stamp.id;
          state.clipboard = {
            width: stamp.width,
            height: stamp.height,
            cells: cloneCells(stamp.cells),
          };
          return true;
        }, { recordHistory: false, reason: "pattern-clipboard" });
      },

      startPatternPaste: function (stampId) {
        if (!this.setClipboardFromStamp(stampId)) {
          return false;
        }
        return this.startPasteMode();
      },

      getPastePreviewCells: function (anchor, state) {
        const s = state || this.getState();
        const clipboard = s.clipboard;
        if (!clipboard || !anchor) {
          return null;
        }
        const cells = [];
        for (let r = 0; r < clipboard.height; r += 1) {
          for (let c = 0; c < clipboard.width; c += 1) {
            const row = anchor.row - r;
            const col = anchor.col + c;
            if (row < 0 || row >= s.rows || col < 0 || col >= s.cols) {
              continue;
            }
            cells.push({
              row: row,
              col: col,
              cell: cellUtils.cloneCell(clipboard.cells[r][c]),
            });
          }
        }
        return {
          cells: cells,
          rowMin: Math.max(0, anchor.row - (clipboard.height - 1)),
          rowMax: Math.min(s.rows - 1, anchor.row),
          colMin: Math.max(0, anchor.col),
          colMax: Math.min(s.cols - 1, anchor.col + clipboard.width - 1),
          width: clipboard.width,
          height: clipboard.height,
        };
      },

      paintCell: function (row, col, symbolId) {
        return this.applyMutation(function (state) {
          if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) {
            return false;
          }
          const current = cellUtils.normalizeCell(state.grid[row][col]);
          const next = cellUtils.createCell(symbolId, current.fillColor);
          if (cellUtils.isEqual(current, next)) {
            return false;
          }
          state.grid[row][col] = next;
          state.cursor.row = row;
          state.cursor.col = col;
          state.currentRow = row + 1;
          return true;
        }, "paint");
      },
      paintPoints: function (points, reason, symbolId) {
        const target = symbolId || this.getState().currentSymbol;
        return this.applyPoints(points, function (current) {
          return cellUtils.createCell(target, current.fillColor);
        }, reason || "paint-points");
      },
      clearCell: function (row, col) {
        return this.applyMutation(function (state) {
          if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) {
            return false;
          }
          const next = cellUtils.createCell("empty", "");
          if (cellUtils.isEqual(state.grid[row][col], next)) {
            return false;
          }
          state.grid[row][col] = next;
          state.cursor.row = row;
          state.cursor.col = col;
          state.currentRow = row + 1;
          return true;
        }, "erase-cell");
      },

      paintCellColor: function (row, col, fillColor) {
        return this.applyMutation(function (state) {
          if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) {
            return false;
          }
          const current = cellUtils.normalizeCell(state.grid[row][col]);
          const next = cellUtils.createCell(current.symbolId, fillColor || "");
          if (cellUtils.isEqual(current, next)) {
            return false;
          }
          state.grid[row][col] = next;
          state.cursor.row = row;
          state.cursor.col = col;
          state.currentRow = row + 1;
          return true;
        }, "paint-color");
      },

      applyPoints: function (points, painter, reason) {
        const unique = uniquePoints(points);
        if (!unique.length) {
          return false;
        }
        return this.applyMutation(function (state) {
          let changed = false;
          unique.forEach(function (point) {
            if (point.row < 0 || point.row >= state.rows || point.col < 0 || point.col >= state.cols) {
              return;
            }
            const current = cellUtils.normalizeCell(state.grid[point.row][point.col]);
            const next = painter(current, point, state);
            if (!next || cellUtils.isEqual(current, next)) {
              return;
            }
            state.grid[point.row][point.col] = next;
            changed = true;
          });
          if (!changed) {
            return false;
          }
          const last = unique[unique.length - 1];
          state.cursor.row = utils.clamp(last.row, 0, state.rows - 1);
          state.cursor.col = utils.clamp(last.col, 0, state.cols - 1);
          state.currentRow = state.cursor.row + 1;
          return true;
        }, reason || "apply-points");
      },

      clearCells: function (points, reason) {
        return this.applyPoints(points, function () {
          return cellUtils.createCell("empty", "");
        }, reason || "erase-cells");
      },

      colorCells: function (points, fillColor, reason) {
        const nextColor = fillColor || this.getState().currentFillColor;
        return this.applyPoints(points, function (current) {
          return cellUtils.createCell(current.symbolId, nextColor);
        }, reason || "color-cells");
      },

      eraseBlock: function (centerRow, centerCol, size) {
        const state = this.getState();
        const block = utils.clamp(Number(size) || state.eraserSize || 3, 2, 12);
        const radius = Math.floor(block / 2);
        const points = [];
        for (let row = centerRow + radius; row >= centerRow - radius; row -= 1) {
          for (let col = centerCol - radius; col <= centerCol + radius; col += 1) {
            points.push({ row: row, col: col });
          }
        }
        return this.clearCells(points, "erase-block");
      },

      floodFill: function (row, col, symbolId) {
        return this.applyMutation(function (state) {
          if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) {
            return false;
          }
          const target = cellUtils.normalizeCell(state.grid[row][col]);
          if (target.symbolId === symbolId) {
            return false;
          }
          const queue = [[row, col]];
          const visited = {};
          let changed = false;
          while (queue.length > 0) {
            const point = queue.shift();
            const r = point[0];
            const c = point[1];
            const key = r + ":" + c;
            if (visited[key]) {
              continue;
            }
            visited[key] = true;
            if (r < 0 || r >= state.rows || c < 0 || c >= state.cols) {
              continue;
            }
            const current = cellUtils.normalizeCell(state.grid[r][c]);
            if (current.symbolId !== target.symbolId) {
              continue;
            }
            state.grid[r][c] = cellUtils.createCell(symbolId, current.fillColor);
            changed = true;
            queue.push([r - 1, c]);
            queue.push([r + 1, c]);
            queue.push([r, c - 1]);
            queue.push([r, c + 1]);
          }
          if (!changed) {
            return false;
          }
          state.cursor.row = row;
          state.cursor.col = col;
          state.currentRow = row + 1;
          return true;
        }, "fill");
      },
      updateSelection: function (rowStart, colStart, rowEnd, colEnd) {
        return this.store.mutate(function (state) {
          state.selection = {
            rowStart: utils.clamp(rowStart, 0, state.rows - 1),
            rowEnd: utils.clamp(rowEnd, 0, state.rows - 1),
            colStart: utils.clamp(colStart, 0, state.cols - 1),
            colEnd: utils.clamp(colEnd, 0, state.cols - 1),
          };
          state.cursor.row = state.selection.rowEnd;
          state.cursor.col = state.selection.colEnd;
          state.currentRow = state.cursor.row + 1;
          return true;
        }, { recordHistory: false, reason: "selection" });
      },

      clearSelection: function () {
        return this.store.mutate(function (state) {
          if (!state.selection) {
            return false;
          }
          state.selection = null;
          return true;
        }, { recordHistory: false, reason: "selection-clear" });
      },

      normalizeSelection: function () {
        return this.store.mutate(function (state) {
          if (!state.selection) {
            return false;
          }
          const bounds = getSelectionBounds(state.selection);
          state.selection = {
            rowStart: bounds.rowMin,
            rowEnd: bounds.rowMax,
            colStart: bounds.colMin,
            colEnd: bounds.colMax,
          };
          return true;
        }, { recordHistory: false, reason: "selection-normalize" });
      },

      getSelectionBounds: function () {
        return getSelectionBounds(this.getState().selection);
      },

      copySelection: function () {
        const bounds = this.getSelectionBounds();
        if (!bounds) {
          return false;
        }
        return this.store.mutate(function (state) {
          const cells = [];
          for (let r = bounds.rowMax; r >= bounds.rowMin; r -= 1) {
            const row = [];
            for (let c = bounds.colMin; c <= bounds.colMax; c += 1) {
              row.push(cellUtils.cloneCell(state.grid[r][c]));
            }
            cells.push(row);
          }
          state.clipboard = {
            width: bounds.width,
            height: bounds.height,
            cells: cells,
          };
          return true;
        }, { recordHistory: false, reason: "copy" });
      },

      pasteClipboardAtAnchor: function (anchor) {
        return this.applyMutation(function (state) {
          const clipboard = state.clipboard;
          if (!clipboard || !Array.isArray(clipboard.cells) || !anchor) {
            return false;
          }
          let changed = false;
          for (let r = 0; r < clipboard.height; r += 1) {
            for (let c = 0; c < clipboard.width; c += 1) {
              const row = anchor.row - r;
              const col = anchor.col + c;
              if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) {
                continue;
              }
              const value = cellUtils.cloneCell(clipboard.cells[r][c]);
              if (!cellUtils.isEqual(state.grid[row][col], value)) {
                state.grid[row][col] = value;
                changed = true;
              }
            }
          }
          if (!changed) {
            return false;
          }
          state.selection = {
            rowStart: utils.clamp(anchor.row - clipboard.height + 1, 0, state.rows - 1),
            rowEnd: utils.clamp(anchor.row, 0, state.rows - 1),
            colStart: utils.clamp(anchor.col, 0, state.cols - 1),
            colEnd: utils.clamp(anchor.col + clipboard.width - 1, 0, state.cols - 1),
          };
          state.cursor.row = utils.clamp(anchor.row, 0, state.rows - 1);
          state.cursor.col = utils.clamp(anchor.col, 0, state.cols - 1);
          state.currentRow = state.cursor.row + 1;
          return true;
        }, "paste");
      },

      saveSelectionAsStamp: function (name) {
        const bounds = this.getSelectionBounds();
        if (!bounds) {
          return false;
        }
        const stampName = (name || "저장 패턴").trim();
        return this.applyMutation(function (state) {
          const cells = [];
          for (let r = bounds.rowMax; r >= bounds.rowMin; r -= 1) {
            const row = [];
            for (let c = bounds.colMin; c <= bounds.colMax; c += 1) {
              row.push(cellUtils.cloneCell(state.grid[r][c]));
            }
            cells.push(row);
          }
          const id = "stamp_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
          state.stamps.push({
            id: id,
            name: stampName,
            width: bounds.width,
            height: bounds.height,
            cells: cells,
          });
          state.currentStampId = id;
          return true;
        }, "stamp-save");
      },

      placeStamp: function (anchorRow, anchorCol) {
        return this.applyMutation(function (state) {
          if (!state.currentStampId) {
            return false;
          }
          const stamp = state.stamps.find(function (item) {
            return item.id === state.currentStampId;
          });
          if (!stamp) {
            return false;
          }
          let changed = false;
          for (let r = 0; r < stamp.height; r += 1) {
            for (let c = 0; c < stamp.width; c += 1) {
              const row = anchorRow - r;
              const col = anchorCol + c;
              if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) {
                continue;
              }
              const value = cellUtils.cloneCell(stamp.cells[r][c]);
              if (!cellUtils.isEqual(state.grid[row][col], value)) {
                state.grid[row][col] = value;
                changed = true;
              }
            }
          }
          if (!changed) {
            return false;
          }
          state.cursor.row = utils.clamp(anchorRow, 0, state.rows - 1);
          state.cursor.col = utils.clamp(anchorCol, 0, state.cols - 1);
          state.currentRow = state.cursor.row + 1;
          return true;
        }, "stamp-place");
      },

      mirrorSelection: function (axis) {
        const bounds = this.getSelectionBounds();
        if (!bounds) {
          return false;
        }
        return this.applyMutation(function (state) {
          const block = [];
          for (let r = bounds.rowMin; r <= bounds.rowMax; r += 1) {
            const row = [];
            for (let c = bounds.colMin; c <= bounds.colMax; c += 1) {
              row.push(cellUtils.cloneCell(state.grid[r][c]));
            }
            block.push(row);
          }
          if (axis === "horizontal") {
            block.forEach(function (row) {
              row.reverse();
            });
          } else {
            block.reverse();
          }
          let changed = false;
          for (let r = 0; r < block.length; r += 1) {
            for (let c = 0; c < block[r].length; c += 1) {
              if (!cellUtils.isEqual(state.grid[bounds.rowMin + r][bounds.colMin + c], block[r][c])) {
                state.grid[bounds.rowMin + r][bounds.colMin + c] = cellUtils.cloneCell(block[r][c]);
                changed = true;
              }
            }
          }
          return changed;
        }, "mirror");
      },
      createRepeatBoxFromSelection: function (times) {
        const bounds = this.getSelectionBounds();
        if (!bounds) {
          return false;
        }
        return this.applyMutation(function (state) {
          const repeatTimes = utils.clamp(Number(times) || Number(state.ui.repeatTimes) || 2, 2, 999);
          state.repeatBoxes.push({
            id: "repeat_" + Date.now() + "_" + Math.floor(Math.random() * 100000),
            rowStart: bounds.rowMin,
            rowEnd: bounds.rowMax,
            colStart: bounds.colMin,
            colEnd: bounds.colMax,
            times: repeatTimes,
            label: "x" + repeatTimes,
          });
          return true;
        }, "repeat-box");
      },

      removeRepeatBox: function (id) {
        return this.applyMutation(function (state) {
          const before = state.repeatBoxes.length;
          state.repeatBoxes = state.repeatBoxes.filter(function (item) {
            return item.id !== id;
          });
          return before !== state.repeatBoxes.length;
        }, "repeat-remove");
      },

      addNote: function (row, col, text) {
        if (!text) {
          return false;
        }
        return this.applyMutation(function (state) {
          state.notes.push({
            id: "note_" + Date.now() + "_" + Math.floor(Math.random() * 100000),
            row: utils.clamp(row, 0, state.rows - 1),
            col: utils.clamp(col, 0, state.cols - 1),
            text: text,
          });
          return true;
        }, "note-add");
      },

      removeNote: function (id) {
        return this.applyMutation(function (state) {
          const before = state.notes.length;
          state.notes = state.notes.filter(function (item) {
            return item.id !== id;
          });
          return before !== state.notes.length;
        }, "note-remove");
      },

      deleteStamp: function (id) {
        return this.applyMutation(function (state) {
          const before = state.stamps.length;
          state.stamps = state.stamps.filter(function (item) {
            return item.id !== id;
          });
          if (state.currentStampId === id) {
            state.currentStampId = state.stamps.length ? state.stamps[0].id : null;
          }
          return before !== state.stamps.length;
        }, "stamp-delete");
      },

      setCurrentStamp: function (id) {
        return this.store.mutate(function (state) {
          if (state.currentStampId === id) {
            return false;
          }
          state.currentStampId = id;
          return true;
        }, { recordHistory: false, reason: "stamp-select" });
      },

      setCursor: function (row, col) {
        return this.store.mutate(function (state) {
          const nextRow = utils.clamp(row, 0, state.rows - 1);
          const nextCol = utils.clamp(col, 0, state.cols - 1);
          if (state.cursor.row === nextRow && state.cursor.col === nextCol) {
            return false;
          }
          state.cursor.row = nextRow;
          state.cursor.col = nextCol;
          state.currentRow = nextRow + 1;
          return true;
        }, { recordHistory: false, reason: "cursor" });
      },

      jumpToRow: function (rowNumber) {
        return this.store.mutate(function (state) {
          const nextRow = utils.clamp(Number(rowNumber) || 1, 1, state.rows);
          state.currentRow = nextRow;
          state.cursor.row = nextRow - 1;
          return true;
        }, { recordHistory: false, reason: "row-jump" });
      },

      insertRows: function (index1Based, count) {
        return this.applyMutation(function (state) {
          const idx = utils.clamp(Number(index1Based) || 1, 1, state.rows + 1) - 1;
          const amount = utils.clamp(Number(count) || 1, 1, 200);
          const rowsToInsert = [];
          for (let i = 0; i < amount; i += 1) {
            rowsToInsert.push(makeEmptyCells(state.cols));
          }
          state.grid.splice.apply(state.grid, [idx, 0].concat(rowsToInsert));
          state.rows += amount;
          state.cursor.row = utils.clamp(state.cursor.row, 0, state.rows - 1);
          state.currentRow = utils.clamp(state.currentRow, 1, state.rows);
          adjustRepeatBoxesOnInsertRows(state.repeatBoxes, idx, amount);
          state.notes.forEach(function (note) {
            if (note.row >= idx) {
              note.row += amount;
            }
          });
          if (state.selection) {
            if (state.selection.rowStart >= idx) {
              state.selection.rowStart += amount;
            }
            if (state.selection.rowEnd >= idx) {
              state.selection.rowEnd += amount;
            }
          }
          return true;
        }, "insert-rows");
      },

      deleteRows: function (index1Based, count) {
        return this.applyMutation(function (state) {
          if (state.rows <= 1) {
            return false;
          }
          const idx = utils.clamp(Number(index1Based) || 1, 1, state.rows) - 1;
          const amount = utils.clamp(Number(count) || 1, 1, state.rows - 1);
          state.grid.splice(idx, amount);
          state.rows -= amount;
          state.cursor.row = utils.clamp(state.cursor.row, 0, state.rows - 1);
          state.currentRow = utils.clamp(state.currentRow, 1, state.rows);
          state.repeatBoxes = adjustRepeatBoxesOnDeleteRows(state.repeatBoxes, idx, amount);
          state.notes = state.notes.map(function (note) {
            if (note.row >= idx + amount) {
              note.row -= amount;
              return note;
            }
            if (note.row < idx) {
              return note;
            }
            return null;
          }).filter(Boolean);
          if (state.selection) {
            const next = cloneRect(state.selection);
            if (next.rowStart >= idx + amount) {
              next.rowStart -= amount;
            } else if (next.rowStart >= idx) {
              next.rowStart = idx;
            }
            if (next.rowEnd >= idx + amount) {
              next.rowEnd -= amount;
            } else if (next.rowEnd >= idx) {
              next.rowEnd = Math.max(0, idx - 1);
            }
            state.selection = next.rowStart <= next.rowEnd ? next : null;
          }
          return true;
        }, "delete-rows");
      },

      insertCols: function (index1Based, count) {
        return this.applyMutation(function (state) {
          const idx = utils.clamp(Number(index1Based) || 1, 1, state.cols + 1) - 1;
          const amount = utils.clamp(Number(count) || 1, 1, 200);
          for (let r = 0; r < state.rows; r += 1) {
            state.grid[r].splice.apply(state.grid[r], [idx, 0].concat(makeEmptyCells(amount)));
          }
          state.cols += amount;
          state.cursor.col = utils.clamp(state.cursor.col, 0, state.cols - 1);
          adjustRepeatBoxesOnInsertCols(state.repeatBoxes, idx, amount);
          state.notes.forEach(function (note) {
            if (note.col >= idx) {
              note.col += amount;
            }
          });
          if (state.selection) {
            if (state.selection.colStart >= idx) {
              state.selection.colStart += amount;
            }
            if (state.selection.colEnd >= idx) {
              state.selection.colEnd += amount;
            }
          }
          return true;
        }, "insert-cols");
      },

      deleteCols: function (index1Based, count) {
        return this.applyMutation(function (state) {
          if (state.cols <= 1) {
            return false;
          }
          const idx = utils.clamp(Number(index1Based) || 1, 1, state.cols) - 1;
          const amount = utils.clamp(Number(count) || 1, 1, state.cols - 1);
          for (let r = 0; r < state.rows; r += 1) {
            state.grid[r].splice(idx, amount);
          }
          state.cols -= amount;
          state.cursor.col = utils.clamp(state.cursor.col, 0, state.cols - 1);
          state.repeatBoxes = adjustRepeatBoxesOnDeleteCols(state.repeatBoxes, idx, amount);
          state.notes = state.notes.map(function (note) {
            if (note.col >= idx + amount) {
              note.col -= amount;
              return note;
            }
            if (note.col < idx) {
              return note;
            }
            return null;
          }).filter(Boolean);
          if (state.selection) {
            const next = cloneRect(state.selection);
            if (next.colStart >= idx + amount) {
              next.colStart -= amount;
            } else if (next.colStart >= idx) {
              next.colStart = idx;
            }
            if (next.colEnd >= idx + amount) {
              next.colEnd -= amount;
            } else if (next.colEnd >= idx) {
              next.colEnd = Math.max(0, idx - 1);
            }
            state.selection = next.colStart <= next.colEnd ? next : null;
          }
          return true;
        }, "delete-cols");
      },

      buildLineCells: function (start, end) {
        if (!start || !end) {
          return [];
        }
        const cells = [];
        let x0 = start.col;
        let y0 = start.row;
        const x1 = end.col;
        const y1 = end.row;
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        while (true) {
          cells.push({ row: y0, col: x0 });
          if (x0 === x1 && y0 === y1) {
            break;
          }
          const e2 = err * 2;
          if (e2 > -dy) {
            err -= dy;
            x0 += sx;
          }
          if (e2 < dx) {
            err += dx;
            y0 += sy;
          }
        }
        return uniquePoints(cells);
      },

      buildRectCells: function (start, end, filled) {
        if (!start || !end) {
          return [];
        }
        const rowMin = Math.min(start.row, end.row);
        const rowMax = Math.max(start.row, end.row);
        const colMin = Math.min(start.col, end.col);
        const colMax = Math.max(start.col, end.col);
        const cells = [];
        for (let row = rowMin; row <= rowMax; row += 1) {
          for (let col = colMin; col <= colMax; col += 1) {
            const border = row === rowMin || row === rowMax || col === colMin || col === colMax;
            if (filled || border) {
              cells.push({ row: row, col: col });
            }
          }
        }
        return uniquePoints(cells);
      },

      buildEllipseCells: function (start, end, filled) {
        if (!start || !end) {
          return [];
        }
        const rowMin = Math.min(start.row, end.row);
        const rowMax = Math.max(start.row, end.row);
        const colMin = Math.min(start.col, end.col);
        const colMax = Math.max(start.col, end.col);
        const centerRow = (rowMin + rowMax) / 2;
        const centerCol = (colMin + colMax) / 2;
        const radiusRow = Math.max(0.5, (rowMax - rowMin + 1) / 2);
        const radiusCol = Math.max(0.5, (colMax - colMin + 1) / 2);
        const innerRadiusRow = Math.max(0.1, radiusRow - 1);
        const innerRadiusCol = Math.max(0.1, radiusCol - 1);
        const cells = [];
        for (let row = rowMin; row <= rowMax; row += 1) {
          for (let col = colMin; col <= colMax; col += 1) {
            const y = (row - centerRow) / radiusRow;
            const x = (col - centerCol) / radiusCol;
            const outer = (x * x) + (y * y);
            if (outer > 1) {
              continue;
            }
            if (filled) {
              cells.push({ row: row, col: col });
              continue;
            }
            const innerY = (row - centerRow) / innerRadiusRow;
            const innerX = (col - centerCol) / innerRadiusCol;
            const inner = (innerX * innerX) + (innerY * innerY);
            if (inner > 1) {
              cells.push({ row: row, col: col });
            }
          }
        }
        return uniquePoints(cells);
      },

      zoomAt: function (screenX, screenY, factor) {
        return this.store.mutate(function (state) {
          const prev = state.view.zoom;
          const next = utils.clamp(prev * factor, 0.25, 5);
          if (Math.abs(next - prev) < 0.0001) {
            return false;
          }
          const worldX = (screenX - state.view.panX) / prev;
          const worldY = (screenY - state.view.panY) / prev;
          state.view.zoom = next;
          state.view.panX = screenX - worldX * next;
          state.view.panY = screenY - worldY * next;
          return true;
        }, { recordHistory: false, reason: "zoom" });
      },

      setZoom: function (zoom) {
        return this.store.mutate(function (state) {
          const next = utils.clamp(Number(zoom) || 1, 0.25, 5);
          if (Math.abs(next - state.view.zoom) < 0.0001) {
            return false;
          }
          state.view.zoom = next;
          return true;
        }, { recordHistory: false, reason: "zoom-set" });
      },

      resetView: function () {
        return this.fitChartToViewport();
      },

      beginPan: function (event) {
        const state = this.getState();
        this.isPanning = true;
        this.panStart.x = event.clientX;
        this.panStart.y = event.clientY;
        this.panStart.panX = state.view.panX;
        this.panStart.panY = state.view.panY;
      },

      getActiveTool: function () {
        const state = this.getState();
        return tools[state.currentTool] || tools.brush;
      },

      shouldPanForEvent: function (event) {
        const state = this.getState();
        return state.currentTool === "pan" || event.button === 1 || event.button === 2 || (!!this.keyboard.spacePressed && event.pointerType !== "touch");
      },

      handlePastePointerDown: function (event, cell) {
        if (!cell) {
          return;
        }
        if (event.pointerType === "touch") {
          const anchor = this.transient.pasteAnchor;
          const same = anchor && anchor.row === cell.row && anchor.col === cell.col;
          this.transient.pasteAnchor = { row: cell.row, col: cell.col };
          this.notifyTransientChange();
          if (same) {
            this.pasteClipboardAtAnchor(cell);
            this.cancelPasteMode();
          }
          return;
        }
        this.pasteClipboardAtAnchor(cell);
        this.cancelPasteMode();
      },

      handlePointerDown: function (event) {
        event.preventDefault();
        this.canvas.focus();
        this.activePointerId = event.pointerId;
        if (this.canvas.setPointerCapture) {
          try {
            this.canvas.setPointerCapture(event.pointerId);
          } catch (error) {}
        }
        const cell = this.eventToCell(event);
        this.setHoverCell(cell);
        if (this.transient.pasteMode) {
          this.handlePastePointerDown(event, cell);
          return;
        }
        if (this.shouldPanForEvent(event)) {
          this.beginPan(event);
          return;
        }
        this.pointerDown = true;
        const tool = this.getActiveTool();
        if (tool && tool.onPointerDown) {
          tool.onPointerDown(this, cell, event);
        }
      },

      handlePointerMove: function (event) {
        if (this.activePointerId != null && event.pointerId != null && event.pointerId !== this.activePointerId) {
          return;
        }
        const cell = this.eventToCell(event);
        this.setHoverCell(cell);
        if (this.isPanning) {
          const dx = event.clientX - this.panStart.x;
          const dy = event.clientY - this.panStart.y;
          const panX = this.panStart.panX + dx;
          const panY = this.panStart.panY + dy;
          this.store.mutate(function (state) {
            state.view.panX = panX;
            state.view.panY = panY;
            return true;
          }, { recordHistory: false, reason: "pan-drag" });
          return;
        }
        if (!this.pointerDown) {
          return;
        }
        const tool = this.getActiveTool();
        if (tool && tool.onPointerMove) {
          tool.onPointerMove(this, cell, event);
        }
      },

      handlePointerUp: function (event) {
        if (this.activePointerId != null && event.pointerId != null && event.pointerId !== this.activePointerId) {
          return;
        }
        const tool = this.getActiveTool();
        if (this.isPanning) {
          this.isPanning = false;
          this.canvas.style.cursor = "grab";
        }
        if (this.pointerDown && tool && tool.onPointerUp) {
          tool.onPointerUp(this, this.eventToCell(event), event);
        }
        this.pointerDown = false;
        this.endBatch();
        if (this.canvas.releasePointerCapture && this.activePointerId != null) {
          try {
            this.canvas.releasePointerCapture(this.activePointerId);
          } catch (error) {}
        }
        this.activePointerId = null;
      },

      handleWheel: function (event) {
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        this.zoomAt(event.clientX - rect.left, event.clientY - rect.top, event.deltaY < 0 ? 1.1 : 0.9);
      },
      handleKeyDown: function (event) {
        const tag = (document.activeElement && document.activeElement.tagName) || "";
        const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
        const key = String(event.key || "").toLowerCase();
        if (event.code === "Space") {
          this.keyboard.spacePressed = true;
          if (!typing) {
            event.preventDefault();
          }
        }
        if (typing) {
          return;
        }
        const state = this.getState();
        if ((event.ctrlKey || event.metaKey) && key === "z") {
          event.preventDefault();
          if (event.shiftKey) {
            this.store.redo();
          } else {
            this.store.undo();
          }
          return;
        }
        if ((event.ctrlKey || event.metaKey) && key === "y") {
          event.preventDefault();
          this.store.redo();
          return;
        }
        if ((event.ctrlKey || event.metaKey) && key === "s") {
          event.preventDefault();
          window.dispatchEvent(new CustomEvent("knitchart:save-json"));
          return;
        }
        if (event.altKey && key === "s") {
          event.preventDefault();
          window.dispatchEvent(new CustomEvent("knitchart:save-pattern"));
          return;
        }
        if (!event.ctrlKey && !event.metaKey && !event.altKey) {
          if (key === "d") {
            event.preventDefault();
            window.dispatchEvent(new CustomEvent("knitchart:toggle-symbol-drawer"));
            return;
          }
          if (key === "b") {
            event.preventDefault();
            this.store.mutate(function (next) { next.currentTool = "brush"; return true; }, { recordHistory: false, reason: "shortcut-tool" });
            return;
          }
          if (key === "c") {
            event.preventDefault();
            this.store.mutate(function (next) { next.currentTool = "paint"; return true; }, { recordHistory: false, reason: "shortcut-tool" });
            return;
          }
          if (key === "e") {
            event.preventDefault();
            this.store.mutate(function (next) { next.currentTool = event.shiftKey ? "blockEraser" : "eraser"; return true; }, { recordHistory: false, reason: "shortcut-tool" });
            return;
          }
          if (key === "q") {
            event.preventDefault();
            this.store.mutate(function (next) { next.currentTool = "select"; return true; }, { recordHistory: false, reason: "shortcut-tool" });
            return;
          }
          if (key === "f") {
            event.preventDefault();
            this.store.mutate(function (next) { next.currentTool = "fill"; return true; }, { recordHistory: false, reason: "shortcut-tool" });
            return;
          }
          if (key === "l") {
            event.preventDefault();
            this.store.mutate(function (next) { next.currentTool = "line"; return true; }, { recordHistory: false, reason: "shortcut-tool" });
            return;
          }
          if (key === "r") {
            event.preventDefault();
            this.store.mutate(function (next) { next.currentTool = "rect"; return true; }, { recordHistory: false, reason: "shortcut-tool" });
            return;
          }
          if (key === "o") {
            event.preventDefault();
            this.store.mutate(function (next) { next.currentTool = "circle"; return true; }, { recordHistory: false, reason: "shortcut-tool" });
            return;
          }
          if (key === "n") {
            event.preventDefault();
            this.store.mutate(function (next) { next.currentTool = "textNote"; return true; }, { recordHistory: false, reason: "shortcut-tool" });
            return;
          }
          if (key === "m") {
            event.preventDefault();
            this.store.mutate(function (next) { next.currentTool = "pan"; return true; }, { recordHistory: false, reason: "shortcut-tool" });
            return;
          }
          if (key === "p") {
            event.preventDefault();
            window.dispatchEvent(new CustomEvent("knitchart:open-pattern-picker"));
            return;
          }
        }
        if (event.key === "Escape") {
          if (this.cancelPasteMode()) {
            event.preventDefault();
            return;
          }
          if (this.clearSelection()) {
            event.preventDefault();
          }
          return;
        }
        if (event.key === "Enter" && this.transient.pasteMode) {
          event.preventDefault();
          const anchor = this.transient.pasteAnchor || { row: state.cursor.row, col: state.cursor.col };
          this.pasteClipboardAtAnchor(anchor);
          this.cancelPasteMode();
          return;
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          this.setCursor(state.cursor.row, state.cursor.col - 1);
          if (this.transient.pasteMode) {
            this.transient.pasteAnchor = { row: this.getState().cursor.row, col: this.getState().cursor.col };
            this.notifyTransientChange();
          }
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          this.setCursor(state.cursor.row, state.cursor.col + 1);
          if (this.transient.pasteMode) {
            this.transient.pasteAnchor = { row: this.getState().cursor.row, col: this.getState().cursor.col };
            this.notifyTransientChange();
          }
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          this.setCursor(state.cursor.row + 1, state.cursor.col);
          if (this.transient.pasteMode) {
            this.transient.pasteAnchor = { row: this.getState().cursor.row, col: this.getState().cursor.col };
            this.notifyTransientChange();
          }
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          this.setCursor(state.cursor.row - 1, state.cursor.col);
          if (this.transient.pasteMode) {
            this.transient.pasteAnchor = { row: this.getState().cursor.row, col: this.getState().cursor.col };
            this.notifyTransientChange();
          }
          return;
        }
        if (event.code === "Space" && !this.transient.pasteMode) {
          event.preventDefault();
          this.beginBatch();
          if (state.currentTool === "paint") {
            this.paintCellColor(state.cursor.row, state.cursor.col, state.currentFillColor);
          } else if (state.currentTool === "eraser") {
            this.clearCell(state.cursor.row, state.cursor.col);
          } else if (state.currentTool === "blockEraser") {
            this.eraseBlock(state.cursor.row, state.cursor.col, state.eraserSize);
          } else if (state.currentTool === "fill") {
            this.floodFill(state.cursor.row, state.cursor.col, state.currentSymbol);
          } else {
            this.paintCell(state.cursor.row, state.cursor.col, state.currentSymbol);
          }
          this.endBatch();
        }
      },
      handleKeyUp: function (event) {
        if (event.code === "Space") {
          this.keyboard.spacePressed = false;
        }
      },

      resize: function () {
        const rect = (this.host || this.canvas).getBoundingClientRect();
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));
        const dpr = window.devicePixelRatio || 1;
        const targetW = Math.floor(width * dpr);
        const targetH = Math.floor(height * dpr);
        if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
          this.canvas.width = targetW;
          this.canvas.height = targetH;
          this.dpr = dpr;
        }
        this.render();
      },
      drawCellOverlays: function (state) {
        const size = state.cellSize;
        const pack = window.KnitChartSymbols.getPack(state.packId);
        const context = this.ctx;
        if (state.selection) {
          const bounds = getSelectionBounds(state.selection);
          const x = this.margin.left + bounds.colMin * size;
          const y = this.margin.top + (state.rows - 1 - bounds.rowMax) * size;
          const w = bounds.width * size;
          const h = bounds.height * size;
          context.save();
          context.fillStyle = "rgba(37, 99, 235, 0.08)";
          context.fillRect(x, y, w, h);
          context.strokeStyle = "#2563eb";
          context.lineWidth = 2;
          context.setLineDash([8, 4]);
          context.strokeRect(x + 1, y + 1, w - 2, h - 2);
          context.restore();
        }

        if (this.transient.hoverCell) {
          const hoverPoint = this.cellToWorld(this.transient.hoverCell.row, this.transient.hoverCell.col, state);
          context.save();
          context.strokeStyle = "rgba(15, 23, 42, 0.28)";
          context.lineWidth = 1.5;
          context.strokeRect(hoverPoint.x + 1, hoverPoint.y + 1, size - 2, size - 2);
          context.restore();
        }

        if (this.transient.shapePreview && this.transient.shapePreview.cells.length) {
          context.save();
          context.fillStyle = hexToRgba(state.currentFillColor, 0.24);
          this.transient.shapePreview.cells.forEach(function (point) {
            const world = this.cellToWorld(point.row, point.col, state);
            context.fillRect(world.x, world.y, size, size);
          }, this);
          context.strokeStyle = hexToRgba(state.applyFillColor ? state.currentFillColor : "#2563eb", 0.95);
          context.lineWidth = 1.5;
          this.transient.shapePreview.cells.forEach(function (point) {
            const world = this.cellToWorld(point.row, point.col, state);
            context.strokeRect(world.x + 1, world.y + 1, size - 2, size - 2);
          }, this);
          if (this.transient.shapePreview.label) {
            const first = this.transient.shapePreview.cells[0];
            if (first) {
              const base = this.cellToWorld(first.row, first.col, state);
              context.fillStyle = "rgba(15, 23, 42, 0.86)";
              drawRoundRect(context, base.x + 6, base.y + 6, 74, 20, 10);
              context.fill();
              context.fillStyle = "#ffffff";
              context.font = "11px 'Segoe UI', sans-serif";
              context.fillText(this.transient.shapePreview.label, base.x + 12, base.y + 20);
            }
          }
          context.restore();
        }

        if (this.transient.pasteMode && state.clipboard && this.transient.pasteAnchor) {
          const preview = this.getPastePreviewCells(this.transient.pasteAnchor, state);
          if (preview && preview.cells.length) {
            context.save();
            preview.cells.forEach(function (item) {
              const point = this.cellToWorld(item.row, item.col, state);
              const fillColor = cellUtils.fillColorOf(item.cell);
              context.fillStyle = fillColor ? hexToRgba(fillColor, 0.7) : "rgba(99, 102, 241, 0.12)";
              context.fillRect(point.x, point.y, size, size);
            }, this);
            const x = this.margin.left + preview.colMin * size;
            const y = this.margin.top + (state.rows - 1 - preview.rowMax) * size;
            const w = (preview.colMax - preview.colMin + 1) * size;
            const h = (preview.rowMax - preview.rowMin + 1) * size;
            context.strokeStyle = "#4f46e5";
            context.lineWidth = 2;
            context.setLineDash([6, 4]);
            context.strokeRect(x + 1, y + 1, w - 2, h - 2);
            context.setLineDash([]);
            context.fillStyle = "#312e81";
            drawRoundRect(context, x + 6, y + 6, 78, 20, 10);
            context.fill();
            context.fillStyle = "#ffffff";
            context.font = "11px 'Segoe UI', sans-serif";
            context.fillText("패턴 미리보기", x + 12, y + 20);
            preview.cells.forEach(function (item) {
              const symbolId = cellUtils.symbolIdOf(item.cell);
              if (!symbolId || symbolId === "empty") {
                return;
              }
              const point = this.cellToWorld(item.row, item.col, state);
              pack.drawSymbolCanvas(context, symbolId, point.x, point.y, size, "#312e81", 0.62);
            }, this);
            context.restore();
          }
        }
      },
      drawChart: function (state, pack) {
        const context = this.ctx;
        const size = state.cellSize;
        const chartX = this.margin.left;
        const chartY = this.margin.top;
        const chartW = state.cols * size;
        const chartH = state.rows * size;

        context.fillStyle = "rgba(255,255,255,0.9)";
        drawRoundRect(context, chartX - 8, chartY - 8, chartW + 16, chartH + 16, 22);
        context.fill();

        context.fillStyle = "#ffffff";
        context.fillRect(chartX, chartY, chartW, chartH);

        const currentRowIndex = utils.clamp(state.currentRow, 1, state.rows) - 1;
        const displayHighlight = state.rows - 1 - currentRowIndex;
        context.fillStyle = "rgba(14, 165, 233, 0.12)";
        context.fillRect(chartX, chartY + displayHighlight * size, chartW, size);

        for (let row = 0; row < state.rows; row += 1) {
          for (let col = 0; col < state.cols; col += 1) {
            const cell = cellUtils.normalizeCell(state.grid[row][col]);
            if (!cell.fillColor) {
              continue;
            }
            const point = this.cellToWorld(row, col, state);
            context.fillStyle = cell.fillColor;
            context.fillRect(point.x, point.y, size, size);
          }
        }

        if (state.view.showGrid) {
          context.strokeStyle = "rgba(148, 163, 184, 0.5)";
          context.lineWidth = 1;
          context.beginPath();
          for (let c = 0; c <= state.cols; c += 1) {
            const x = chartX + c * size + 0.5;
            context.moveTo(x, chartY + 0.5);
            context.lineTo(x, chartY + chartH + 0.5);
          }
          for (let r = 0; r <= state.rows; r += 1) {
            const y = chartY + r * size + 0.5;
            context.moveTo(chartX + 0.5, y);
            context.lineTo(chartX + chartW + 0.5, y);
          }
          context.stroke();
        }

        for (let row = 0; row < state.rows; row += 1) {
          for (let col = 0; col < state.cols; col += 1) {
            const symbolId = cellUtils.symbolIdOf(state.grid[row][col]);
            if (!symbolId || symbolId === "empty") {
              continue;
            }
            const point = this.cellToWorld(row, col, state);
            pack.drawSymbolCanvas(context, symbolId, point.x, point.y, size, "#0f172a");
          }
        }

        this.drawCellOverlays(state);

        context.strokeStyle = "#0f172a";
        context.lineWidth = 1.4;
        context.strokeRect(chartX, chartY, chartW, chartH);

        state.repeatBoxes.forEach(function (box) {
          const rowMin = Math.min(box.rowStart, box.rowEnd);
          const rowMax = Math.max(box.rowStart, box.rowEnd);
          const colMin = Math.min(box.colStart, box.colEnd);
          const colMax = Math.max(box.colStart, box.colEnd);
          const x = chartX + colMin * size;
          const y = chartY + (state.rows - 1 - rowMax) * size;
          const w = (colMax - colMin + 1) * size;
          const h = (rowMax - rowMin + 1) * size;
          context.save();
          context.strokeStyle = "#d97706";
          context.lineWidth = 2;
          context.setLineDash([6, 4]);
          context.strokeRect(x + 1, y + 1, w - 2, h - 2);
          context.setLineDash([]);
          context.fillStyle = "rgba(217, 119, 6, 0.9)";
          drawRoundRect(context, x + 5, y + 4, 40, 18, 8);
          context.fill();
          context.fillStyle = "#ffffff";
          context.font = "11px 'Segoe UI', sans-serif";
          context.fillText(box.label || ("x" + box.times), x + 11, y + 17);
          context.restore();
        });

        const cursorPoint = this.cellToWorld(state.cursor.row, state.cursor.col, state);
        context.save();
        context.strokeStyle = "#e11d48";
        context.lineWidth = 2.4;
        context.strokeRect(cursorPoint.x + 1, cursorPoint.y + 1, size - 2, size - 2);
        context.restore();

        context.save();
        context.font = "12px 'Segoe UI', sans-serif";
        context.fillStyle = "#475569";
        if (state.view.showRowNumbers) {
          for (let rowNum = 1; rowNum <= state.rows; rowNum += 1) {
            const y = chartY + (state.rows - rowNum) * size + size * 0.62;
            context.fillText(String(rowNum), chartX - 34, y);
          }
        }
        if (state.view.showColNumbers) {
          for (let colNum = 1; colNum <= state.cols; colNum += 1) {
            const x = chartX + (colNum - 1) * size + size * 0.26;
            context.fillText(String(colNum), x, chartY - 12);
          }
        }
        context.restore();

        state.notes.forEach(function (note, index) {
          const anchor = this.cellToWorld(note.row, note.col, state);
          const x = anchor.x + size + 6;
          const y = anchor.y + 6;
          const text = note.text.length > 24 ? note.text.slice(0, 23) + "..." : note.text;
          context.font = "11px 'Segoe UI', sans-serif";
          const width = Math.max(84, context.measureText((index + 1) + ". " + text).width + 14);
          context.save();
          context.fillStyle = "rgba(255, 250, 235, 0.95)";
          context.strokeStyle = "#f59e0b";
          context.lineWidth = 1;
          drawRoundRect(context, x, y, width, 22, 10);
          context.fill();
          context.stroke();
          context.fillStyle = "#92400e";
          context.fillText((index + 1) + ". " + text, x + 6, y + 14);
          context.restore();
        }, this);

        const direction = window.KnitChartStore.getRowDirection(state, state.currentRow);
        const surface = window.KnitChartStore.getRowSurface(state, state.currentRow);
        const surfaceLabel = surface === "RS" ? "겉면(RS)" : "안쪽면(WS)";
        const dirText = direction === "rtl" ? "오른쪽→왼쪽" : "왼쪽→오른쪽";
        const arrow = direction === "rtl" ? "<-" : "->";
        context.save();
        context.fillStyle = "#0f172a";
        context.font = "600 14px 'Segoe UI', sans-serif";
        context.fillText("현재 단 " + state.currentRow + "  " + surfaceLabel + "  " + arrow + "  " + dirText, chartX, chartY + chartH + 28);
        if (state.chartMode === "flat" && state.evenRowInterpretHelp && state.currentRow % 2 === 0) {
          context.fillStyle = "#7c2d12";
          context.font = "12px 'Segoe UI', sans-serif";
          context.fillText("짝수단은 겉/안을 반대로 읽는 도움말이 켜져 있습니다.", chartX, chartY + chartH + 48);
        }
        if (this.transient.pasteMode) {
          context.fillStyle = "#312e81";
          context.font = "12px 'Segoe UI', sans-serif";
          context.fillText("패턴 놓기 모드: 놓을 칸을 가리킨 뒤 클릭 또는 탭", chartX + 280, chartY + chartH + 28);
        }
        context.restore();
      },
      render: function () {
        const state = this.getState();
        const pack = window.KnitChartSymbols.getPack(state.packId);
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.scale(this.dpr, this.dpr);
        const width = this.canvas.width / this.dpr;
        const height = this.canvas.height / this.dpr;
        const background = this.ctx.createLinearGradient(0, 0, width, height);
        background.addColorStop(0, "#f8fbff");
        background.addColorStop(0.5, "#f1f5ff");
        background.addColorStop(1, "#eefbf7");
        this.ctx.fillStyle = background;
        this.ctx.fillRect(0, 0, width, height);
        this.ctx.translate(state.view.panX, state.view.panY);
        this.ctx.scale(state.view.zoom, state.view.zoom);
        this.drawChart(state, pack);
        this.ctx.restore();

        if (this.transient.pasteMode) {
          this.canvas.style.cursor = "copy";
        } else if (state.currentTool === "pan") {
          this.canvas.style.cursor = this.isPanning ? "grabbing" : "grab";
        } else {
          this.canvas.style.cursor = "crosshair";
        }
      },

      attachEvents: function () {
        const self = this;
        this.canvas.addEventListener("contextmenu", function (event) {
          event.preventDefault();
        });
        this.canvas.addEventListener("pointerdown", function (event) {
          self.handlePointerDown(event);
        });
        this.canvas.addEventListener("pointermove", function (event) {
          self.handlePointerMove(event);
        });
        this.canvas.addEventListener("pointerup", function (event) {
          self.handlePointerUp(event);
        });
        this.canvas.addEventListener("pointercancel", function (event) {
          self.handlePointerUp(event);
        });
        this.canvas.addEventListener("pointerleave", function () {
          if (!self.pointerDown && !self.transient.pasteMode) {
            self.setHoverCell(null);
          }
        });
        this.canvas.addEventListener("wheel", function (event) {
          self.handleWheel(event);
        }, { passive: false });
        window.addEventListener("keydown", function (event) {
          self.handleKeyDown(event);
        });
        window.addEventListener("keyup", function (event) {
          self.handleKeyUp(event);
        });
        if (window.ResizeObserver) {
          this.resizeObserver = new ResizeObserver(function () {
            self.resize();
            self.fitChartToViewport();
          });
          this.resizeObserver.observe(this.host || this.canvas);
        } else {
          window.addEventListener("resize", function () {
            self.resize();
            self.fitChartToViewport();
          });
        }
      },
      createPngDataUrl: function () {
        return this.canvas.toDataURL("image/png");
      },
    };

    editor.attachEvents();
    editor.resize();
    editor.fitChartToViewport();
    store.subscribe(function () {
      editor.render();
    });
    return editor;
  }

  window.KnitChartEditorCanvas = {
    createEditorCanvas: createEditorCanvas,
    getSelectionBounds: getSelectionBounds,
  };
})();















