(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";

  function buildSvg(body) {
    return '<svg xmlns="' + SVG_NS + '" viewBox="0 0 100 100" width="100" height="100">' + body + "</svg>";
  }

  function line(x1, y1, x2, y2, width) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="currentColor" stroke-width="' + width + '" stroke-linecap="round" />';
  }

  function polyline(points, width, fill) {
    return '<polyline points="' + points + '" stroke="currentColor" stroke-width="' + width + '" stroke-linecap="round" stroke-linejoin="round" fill="' + (fill || "none") + '" />';
  }

  function path(d, width, fill) {
    return '<path d="' + d + '" stroke="currentColor" stroke-width="' + width + '" stroke-linecap="round" stroke-linejoin="round" fill="' + (fill || "none") + '" />';
  }

  function circle(cx, cy, r, width, fill, opacity) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" stroke="currentColor" stroke-width="' + width + '" fill="' + (fill || "none") + '"' + (opacity ? ' opacity="' + opacity + '"' : "") + ' />';
  }

  function rect(x, y, w, h, rx, fill, opacity) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx || 0) + '" fill="' + (fill || "none") + '"' + (opacity ? ' opacity="' + opacity + '"' : "") + ' />';
  }

  function roundedRectPath(ctx, x, y, w, h, radius) {
    const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function defineSymbol(meta, drawCanvas) {
    return Object.assign({}, meta, {
      svg: buildSvg(meta.svgBody),
      drawCanvas: drawCanvas,
    });
  }

  const symbols = [
    defineSymbol({
      id: "empty",
      name_ko: "공백",
      abbr: "-",
      category: "기본",
      defaultOrder: 1,
      stitchEffect: { consumes: 0, produces: 0 },
      svgBody: circle(50, 50, 4, 0, "currentColor", 0.22),
    }, function (ctx, size) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.5, Math.max(1.2, size * 0.06), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }),
    defineSymbol({
      id: "noStitch",
      name_ko: "없음",
      abbr: "NS",
      category: "기본",
      defaultOrder: 2,
      stitchEffect: { consumes: 0, produces: 0 },
      svgBody: rect(18, 18, 64, 64, 12, "currentColor", 0.08) + line(26, 26, 74, 74, 9) + line(74, 26, 26, 74, 9),
    }, function (ctx, size) {
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = ctx.strokeStyle;
      roundedRectPath(ctx, size * 0.18, size * 0.18, size * 0.64, size * 0.64, size * 0.12);
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(size * 0.26, size * 0.26);
      ctx.lineTo(size * 0.74, size * 0.74);
      ctx.moveTo(size * 0.74, size * 0.26);
      ctx.lineTo(size * 0.26, size * 0.74);
      ctx.stroke();
    }),
    defineSymbol({
      id: "knit",
      name_ko: "겉뜨기",
      abbr: "K",
      category: "기본",
      defaultOrder: 3,
      stitchEffect: { consumes: 1, produces: 1 },
      svgBody: line(50, 14, 50, 86, 12),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.5, size * 0.14);
      ctx.lineTo(size * 0.5, size * 0.86);
      ctx.stroke();
    }),
    defineSymbol({
      id: "purl",
      name_ko: "안뜨기",
      abbr: "P",
      category: "기본",
      defaultOrder: 4,
      stitchEffect: { consumes: 1, produces: 1 },
      svgBody: line(14, 50, 86, 50, 12),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.14, size * 0.5);
      ctx.lineTo(size * 0.86, size * 0.5);
      ctx.stroke();
    }),
    defineSymbol({
      id: "ktbl",
      name_ko: "꼬아겉뜨기",
      abbr: "ktbl",
      category: "기본",
      defaultOrder: 5,
      stitchEffect: { consumes: 1, produces: 1 },
      svgBody: line(50, 14, 50, 86, 10) + line(33, 30, 66, 70, 7),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.5, size * 0.14);
      ctx.lineTo(size * 0.5, size * 0.86);
      ctx.moveTo(size * 0.33, size * 0.3);
      ctx.lineTo(size * 0.66, size * 0.7);
      ctx.stroke();
    }),
    defineSymbol({
      id: "ptbl",
      name_ko: "꼬아안뜨기",
      abbr: "ptbl",
      category: "기본",
      defaultOrder: 6,
      stitchEffect: { consumes: 1, produces: 1 },
      svgBody: line(14, 50, 86, 50, 10) + line(30, 34, 70, 66, 7),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.14, size * 0.5);
      ctx.lineTo(size * 0.86, size * 0.5);
      ctx.moveTo(size * 0.3, size * 0.34);
      ctx.lineTo(size * 0.7, size * 0.66);
      ctx.stroke();
    }),
    defineSymbol({
      id: "sl",
      name_ko: "걸러뜨기",
      abbr: "sl",
      category: "기본",
      defaultOrder: 7,
      stitchEffect: { consumes: 1, produces: 1 },
      svgBody: polyline("20,28 50,78 80,28", 9),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.2, size * 0.28);
      ctx.lineTo(size * 0.5, size * 0.78);
      ctx.lineTo(size * 0.8, size * 0.28);
      ctx.stroke();
    }),
    defineSymbol({
      id: "yo",
      name_ko: "바늘비우기",
      abbr: "yo",
      category: "늘림",
      defaultOrder: 8,
      stitchEffect: { consumes: 0, produces: 1 },
      svgBody: circle(50, 50, 26, 9, "none"),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.5, size * 0.26, 0, Math.PI * 2);
      ctx.stroke();
    }),
    defineSymbol({
      id: "m1l",
      name_ko: "왼코늘림",
      abbr: "M1L",
      category: "늘림",
      defaultOrder: 9,
      stitchEffect: { consumes: 0, produces: 1 },
      svgBody: line(26, 70, 74, 30, 9) + line(28, 50, 72, 50, 6),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.26, size * 0.7);
      ctx.lineTo(size * 0.74, size * 0.3);
      ctx.moveTo(size * 0.28, size * 0.5);
      ctx.lineTo(size * 0.72, size * 0.5);
      ctx.stroke();
    }),
    defineSymbol({
      id: "m1r",
      name_ko: "오른코늘림",
      abbr: "M1R",
      category: "늘림",
      defaultOrder: 10,
      stitchEffect: { consumes: 0, produces: 1 },
      svgBody: line(26, 30, 74, 70, 9) + line(28, 50, 72, 50, 6),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.26, size * 0.3);
      ctx.lineTo(size * 0.74, size * 0.7);
      ctx.moveTo(size * 0.28, size * 0.5);
      ctx.lineTo(size * 0.72, size * 0.5);
      ctx.stroke();
    }),
    defineSymbol({
      id: "kfb",
      name_ko: "앞뒤겉뜨기 늘림",
      abbr: "kfb",
      category: "늘림",
      defaultOrder: 11,
      stitchEffect: { consumes: 1, produces: 2 },
      svgBody: line(40, 18, 40, 82, 9) + polyline("54,20 66,50 54,80", 9),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.4, size * 0.18);
      ctx.lineTo(size * 0.4, size * 0.82);
      ctx.moveTo(size * 0.54, size * 0.2);
      ctx.lineTo(size * 0.66, size * 0.5);
      ctx.lineTo(size * 0.54, size * 0.8);
      ctx.stroke();
    }),
    defineSymbol({
      id: "pfb",
      name_ko: "앞뒤안뜨기 늘림",
      abbr: "pfb",
      category: "늘림",
      defaultOrder: 12,
      stitchEffect: { consumes: 1, produces: 2 },
      svgBody: line(18, 40, 82, 40, 9) + polyline("20,54 50,66 80,54", 9),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.18, size * 0.4);
      ctx.lineTo(size * 0.82, size * 0.4);
      ctx.moveTo(size * 0.2, size * 0.54);
      ctx.lineTo(size * 0.5, size * 0.66);
      ctx.lineTo(size * 0.8, size * 0.54);
      ctx.stroke();
    }),
    defineSymbol({
      id: "k2tog",
      name_ko: "오른코2코모아뜨기",
      abbr: "k2tog",
      category: "줄임",
      defaultOrder: 13,
      stitchEffect: { consumes: 2, produces: 1 },
      svgBody: line(20, 80, 80, 20, 11),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.2, size * 0.8);
      ctx.lineTo(size * 0.8, size * 0.2);
      ctx.stroke();
    }),
    defineSymbol({
      id: "ssk",
      name_ko: "왼코2코모아뜨기",
      abbr: "ssk",
      category: "줄임",
      defaultOrder: 14,
      stitchEffect: { consumes: 2, produces: 1 },
      svgBody: line(20, 20, 80, 80, 11),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.2, size * 0.2);
      ctx.lineTo(size * 0.8, size * 0.8);
      ctx.stroke();
    }),
    defineSymbol({
      id: "p2tog",
      name_ko: "안코2코모아뜨기",
      abbr: "p2tog",
      category: "줄임",
      defaultOrder: 15,
      stitchEffect: { consumes: 2, produces: 1 },
      svgBody: line(16, 50, 84, 50, 10) + line(28, 24, 72, 76, 7),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.16, size * 0.5);
      ctx.lineTo(size * 0.84, size * 0.5);
      ctx.moveTo(size * 0.28, size * 0.24);
      ctx.lineTo(size * 0.72, size * 0.76);
      ctx.stroke();
    }),
    defineSymbol({
      id: "k3tog",
      name_ko: "3코모아뜨기",
      abbr: "k3tog",
      category: "줄임",
      defaultOrder: 16,
      stitchEffect: { consumes: 3, produces: 1 },
      svgBody: line(18, 82, 50, 18, 8) + line(50, 82, 50, 18, 8) + line(82, 82, 50, 18, 8),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.18, size * 0.82);
      ctx.lineTo(size * 0.5, size * 0.18);
      ctx.lineTo(size * 0.82, size * 0.82);
      ctx.moveTo(size * 0.5, size * 0.82);
      ctx.lineTo(size * 0.5, size * 0.18);
      ctx.stroke();
    }),
    defineSymbol({
      id: "sk2p",
      name_ko: "중앙3코모아뜨기",
      abbr: "sk2p",
      category: "줄임",
      defaultOrder: 17,
      stitchEffect: { consumes: 3, produces: 1 },
      svgBody: line(18, 26, 50, 74, 8) + line(50, 26, 50, 74, 8) + line(82, 26, 50, 74, 8),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.18, size * 0.26);
      ctx.lineTo(size * 0.5, size * 0.74);
      ctx.lineTo(size * 0.82, size * 0.26);
      ctx.moveTo(size * 0.5, size * 0.26);
      ctx.lineTo(size * 0.5, size * 0.74);
      ctx.stroke();
    }),
    defineSymbol({
      id: "c2l",
      name_ko: "2코 교차 왼쪽",
      abbr: "C2L",
      category: "교차",
      defaultOrder: 18,
      stitchEffect: { consumes: 2, produces: 2 },
      svgBody: line(34, 18, 34, 82, 8) + line(66, 18, 66, 82, 8) + line(70, 30, 30, 70, 8),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.34, size * 0.18);
      ctx.lineTo(size * 0.34, size * 0.82);
      ctx.moveTo(size * 0.66, size * 0.18);
      ctx.lineTo(size * 0.66, size * 0.82);
      ctx.moveTo(size * 0.7, size * 0.3);
      ctx.lineTo(size * 0.3, size * 0.7);
      ctx.stroke();
    }),
    defineSymbol({
      id: "c2r",
      name_ko: "2코 교차 오른쪽",
      abbr: "C2R",
      category: "교차",
      defaultOrder: 19,
      stitchEffect: { consumes: 2, produces: 2 },
      svgBody: line(34, 18, 34, 82, 8) + line(66, 18, 66, 82, 8) + line(30, 30, 70, 70, 8),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.34, size * 0.18);
      ctx.lineTo(size * 0.34, size * 0.82);
      ctx.moveTo(size * 0.66, size * 0.18);
      ctx.lineTo(size * 0.66, size * 0.82);
      ctx.moveTo(size * 0.3, size * 0.3);
      ctx.lineTo(size * 0.7, size * 0.7);
      ctx.stroke();
    }),
    defineSymbol({
      id: "c4l",
      name_ko: "4코 교차 왼쪽",
      abbr: "C4L",
      category: "교차",
      defaultOrder: 20,
      stitchEffect: { consumes: 4, produces: 4 },
      svgBody: line(24, 18, 24, 82, 7) + line(44, 18, 44, 82, 7) + line(56, 18, 56, 82, 7) + line(76, 18, 76, 82, 7) + line(76, 26, 24, 74, 7),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.24, size * 0.18);
      ctx.lineTo(size * 0.24, size * 0.82);
      ctx.moveTo(size * 0.44, size * 0.18);
      ctx.lineTo(size * 0.44, size * 0.82);
      ctx.moveTo(size * 0.56, size * 0.18);
      ctx.lineTo(size * 0.56, size * 0.82);
      ctx.moveTo(size * 0.76, size * 0.18);
      ctx.lineTo(size * 0.76, size * 0.82);
      ctx.moveTo(size * 0.76, size * 0.26);
      ctx.lineTo(size * 0.24, size * 0.74);
      ctx.stroke();
    }),
    defineSymbol({
      id: "c4r",
      name_ko: "4코 교차 오른쪽",
      abbr: "C4R",
      category: "교차",
      defaultOrder: 21,
      stitchEffect: { consumes: 4, produces: 4 },
      svgBody: line(24, 18, 24, 82, 7) + line(44, 18, 44, 82, 7) + line(56, 18, 56, 82, 7) + line(76, 18, 76, 82, 7) + line(24, 26, 76, 74, 7),
    }, function (ctx, size) {
      ctx.beginPath();
      ctx.moveTo(size * 0.24, size * 0.18);
      ctx.lineTo(size * 0.24, size * 0.82);
      ctx.moveTo(size * 0.44, size * 0.18);
      ctx.lineTo(size * 0.44, size * 0.82);
      ctx.moveTo(size * 0.56, size * 0.18);
      ctx.lineTo(size * 0.56, size * 0.82);
      ctx.moveTo(size * 0.76, size * 0.18);
      ctx.lineTo(size * 0.76, size * 0.82);
      ctx.moveTo(size * 0.24, size * 0.26);
      ctx.lineTo(size * 0.76, size * 0.74);
      ctx.stroke();
    }),
    defineSymbol({
      id: "bobble",
      name_ko: "방울뜨기",
      abbr: "bob",
      category: "무늬",
      defaultOrder: 22,
      stitchEffect: { consumes: 1, produces: 1 },
      svgBody: circle(35, 52, 10, 6, "currentColor", 0.1) + circle(50, 40, 10, 6, "currentColor", 0.1) + circle(65, 52, 10, 6, "currentColor", 0.1),
    }, function (ctx, size) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = ctx.strokeStyle;
      [
        [0.35, 0.52],
        [0.5, 0.4],
        [0.65, 0.52],
      ].forEach(function (point) {
        ctx.beginPath();
        ctx.arc(size * point[0], size * point[1], size * 0.1, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
      [
        [0.35, 0.52],
        [0.5, 0.4],
        [0.65, 0.52],
      ].forEach(function (point) {
        ctx.beginPath();
        ctx.arc(size * point[0], size * point[1], size * 0.1, 0, Math.PI * 2);
        ctx.stroke();
      });
    }),
  ];

  const symbolMap = {};
  symbols.forEach(function (symbol) {
    symbolMap[symbol.id] = symbol;
  });

  const pack = {
    id: "KO_KNIT",
    name_ko: "한국 대바늘 기본",
    type: "HAND_KNITTING_ONLY",
    symbols: symbols,
    getSymbol: function (id) {
      return symbolMap[id] || symbolMap.empty;
    },
    listSymbols: function () {
      return symbols.slice();
    },
    defaultOrder: function () {
      return symbols.slice().sort(function (a, b) {
        return a.defaultOrder - b.defaultOrder;
      }).map(function (symbol) {
        return symbol.id;
      });
    },
    drawSymbolCanvas: function (ctx, id, x, y, size, color, alpha) {
      const symbol = this.getSymbol(id);
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = color || "#0f172a";
      ctx.fillStyle = color || "#0f172a";
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.lineWidth = Math.max(1.4, size * 0.1);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      symbol.drawCanvas(ctx, size);
      ctx.restore();
    },
    symbolToSvgGroup: function (id, x, y, size, color, opacity) {
      const symbol = this.getSymbol(id);
      const scale = size / 100;
      return '<g transform="translate(' + x + ' ' + y + ') scale(' + scale + ')" style="color:' + (color || "#0f172a") + ';opacity:' + (opacity == null ? 1 : opacity) + '">' + symbol.svgBody + '</g>';
    },
    createPreviewSvg: function (id, px) {
      const symbol = this.getSymbol(id);
      const size = px || 28;
      return '<svg xmlns="' + SVG_NS + '" viewBox="0 0 100 100" width="' + size + '" height="' + size + '" style="color:#0f172a">' + symbol.svgBody + '</svg>';
    },
  };

  window.KnitChartSymbols = window.KnitChartSymbols || {};
  window.KnitChartSymbols.packs = window.KnitChartSymbols.packs || {};
  window.KnitChartSymbols.packs[pack.id] = pack;
  window.KnitChartSymbols.getPack = function (id) {
    return this.packs[id] || this.packs.KO_KNIT;
  };
})();


