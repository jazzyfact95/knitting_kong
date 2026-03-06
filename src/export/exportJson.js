(function () {
  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 0);
  }

  window.KnitChartExportJson = {
    download: function (state) {
      const payload = {
        app: "KnitChartStudio",
        exportedAt: new Date().toISOString(),
        data: state,
      };
      const name = (state.title || "knit-chart").replace(/[^a-zA-Z0-9-_]/g, "_");
      downloadText(name + ".json", JSON.stringify(payload, null, 2), "application/json");
    },
    downloadText: downloadText,
  };
})();
