(function () {
  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("Failed to read file"));
      };
      reader.readAsText(file, "utf-8");
    });
  }

  async function importFromFile(file) {
    const text = await readFileAsText(file);
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid JSON file");
    }
    const data = parsed.data || parsed;
    return window.KnitChartStore.normalizeImportedState(data);
  }

  window.KnitChartImportJson = {
    importFromFile: importFromFile,
  };
})();
