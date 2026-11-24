// Getting a photo into the page: from the sample, a file, a drop or a paste.
// Nothing here talks to a server. Files are read by the browser, on this device.
const Photo = (() => {
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("unreadable"));
      img.src = url;
    });
  }

  function fromUrl(url) {
    return loadImage(url);
  }

  // Decodes a file the person picked. createImageBitmap also applies the rotation
  // flag phones store in the file, which fixes photos that would come in sideways.
  async function fromFile(file) {
    if (!file.type.startsWith("image/")) throw new Error("not-image");
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (err) {
        // Older browsers reject the options. Fall through to the plain image route.
      }
    }
    const url = URL.createObjectURL(file);
    try {
      return await loadImage(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Draws the source onto the canvas, shrunk so its long side is at most maxEdge,
  // and returns the pixels. Big photos would make every frame slow.
  function drawTo(canvas, source, maxEdge) {
    const sw = source.naturalWidth || source.width;
    const sh = source.naturalHeight || source.height;
    const k = Math.min(1, maxEdge / Math.max(sw, sh));
    canvas.width = Math.round(sw * k);
    canvas.height = Math.round(sh * k);

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; // see-through PNGs would otherwise turn black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    if (source.close) source.close(); // free the decoded bitmap
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  return { fromUrl, fromFile, drawTo };
})();
