// Saving the scan to the person's device as a PNG file.
const Exporter = (() => {
  function savePng(canvas, filename) {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      // Give the browser a moment to start the download before letting go of the data.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  return { savePng };
})();
