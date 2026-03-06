(function () {
  function downloadDataUrl(filename, dataUrl) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function downloadPng(state, options) {
    const opts = options || {};
    const svgMarkup = window.KnitChartExportSvg.buildSvg(state, opts);
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    try {
      const img = new Image();
      const loaded = new Promise(function (resolve, reject) {
        img.onload = resolve;
        img.onerror = reject;
      });
      img.src = url;
      await loaded;

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(img.width * 2));
      canvas.height = Math.max(1, Math.floor(img.height * 2));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const name = (state.title || "knit-chart").replace(/[^a-zA-Z0-9-_]/g, "_");
      downloadDataUrl(name + ".png", canvas.toDataURL("image/png"));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  window.KnitChartExportPng = {
    downloadPng: downloadPng,
  };
})();
