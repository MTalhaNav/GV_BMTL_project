// Every tunable number lives here so the other files stay free of magic values.
const CONFIG = Object.freeze({
  sampleSrc: "assets/sample.jpg",
  sampleName: "sample",

  // Where the page corners sit in the sample photo, as fractions of its width and
  // height: top left, top right, bottom right, bottom left. The demo slides the
  // dots here. If you swap sample.jpg, open the browser console, drag the dots onto
  // the new page and type Scanner.corners() to get the numbers to paste in.
  // Set this to null to switch the demo off.
  sampleCorners: [[0.2625, 0.0944], [0.7042, 0.1333], [0.7458, 0.9], [0.1833, 0.8722]],
  demo: { delayMs: 700, durationMs: 1500, staggerMs: 110 },

  // Photos are shrunk to this long edge before we read their pixels.
  // A full-size phone photo would make every frame crawl.
  maxPhotoEdge: 2000,

  // Width of the flattened scan in pixels. The height comes from the page shape.
  // Big enough to stay sharp on the large centre panel and on high-density screens.
  flatWidth: 1100,

  // Enhance ("scanner look"): the scan is cut into this many blocks across its
  // shorter side to measure the paper's brightness; saturation lifts the colours;
  // whitePoint is what the paper is brightened to (255 is pure white).
  enhance: { blocks: 24, saturation: 1.25, whitePoint: 248 },

  // While something is being dragged we render at a fraction of full size, then
  // redraw at full size once nothing has moved for settleDelayMs. The fraction
  // adapts: it starts at previewScale and moves between min and max so a preview
  // frame costs about previewBudgetMs, whatever the device.
  previewScale: 0.5,
  previewMin: 0.25,
  previewMax: 0.75,
  previewBudgetMs: 10,
  settleDelayMs: 150,

  // Page shapes for the dropdown, written as height divided by width.
  pageShapes: [
    { id: "a4", label: "A4 portrait", ratio: 1.414 },
    { id: "a4-land", label: "A4 landscape", ratio: 0.707 },
    { id: "letter", label: "US Letter", ratio: 1.294 },
    { id: "legal", label: "US Legal", ratio: 1.647 },
    { id: "id-card", label: "ID card", ratio: 0.631 },
    { id: "square", label: "Square", ratio: 1 },
  ],
  defaultShape: "a4",
  customRatio: { min: 0.5, max: 2, step: 0.01 },

  // Starting dot positions as fractions of the photo: TL, TR, BR, BL.
  startDots: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]],

  // On-screen CSS pixels, not canvas pixels.
  dotRadius: 14,
  hitRadius: 28,

  // Magnifier: size on screen, how many times it zooms, and how far it floats
  // away from the dot so a finger does not cover it.
  loupe: { size: 120, zoom: 4, gap: 36 },
});
