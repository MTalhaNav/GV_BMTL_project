// The one-or-two sentence explanation that appears in the note box when someone
// touches a control. Keeping all the wording here means copy can be edited without
// reading any of the code that drives the page.
const Notes = {
  intro:
    "Move a dot, change the page shape or drag a slider. This box explains whatever you touched last.",

  loaded: "Photo loaded on this device. Nothing was uploaded anywhere.",

  demo:
    "The matrix is solved again on every frame of this move. That is all a scan is: a fresh matrix, then one lookup per pixel.",

  dots:
    "Four dot positions give eight equations, which are exactly enough to pin down the eight unknown numbers in the matrix. The solver runs again on every move.",

  shape: (w, h) =>
    `The page shape sets the size of the flat rectangle the matrix starts from, here ${w} by ${h} pixels. The photo does not change, only where its corners get sent.`,

  grey: (percent) =>
    percent === 0
      ? "Greyscale is off. The colours are as photographed."
      : `Each pixel is pulled ${percent}% of the way towards its own brightness: 30% red, 59% green and 11% blue, because the eye is most sensitive to green.`,

  cutoff: (level) =>
    level === 0
      ? "The black and white cut-off is off."
      : `Every pixel is compared with ${level} out of 255. Brighter becomes white, everything else becomes black. It is a single comparison per pixel and it overrides greyscale.`,

  enhance: (on) =>
    on
      ? "Enhance is on. Each pixel is divided by how bright the paper around it is, so shadows cancel out, the paper turns white and the colours are made more vivid, like a scanner app."
      : "Enhance is off. These are the colours exactly as the camera saw them.",

  crop: (on) =>
    on
      ? "A plain crop keeps the upright box around the dots and nothing else. The page is still tilted, which is why a scanner has to stretch instead of cropping."
      : "Back to the stretched scan.",

  forward: (on) =>
    on
      ? "Forward mapping pushes every photo pixel to where it lands. Some scan pixels are hit twice and some never, so gaps appear. The normal scan works the other way round: each scan pixel looks up its own colour, so nothing is missed."
      : "Backward mapping: every scan pixel asks the matrix where to look in the photo, so every pixel gets exactly one value and there are no gaps.",

  loupe: (on) =>
    on
      ? "The magnifier will follow the dot you drag."
      : "Magnifier off.",

  outline: (on) =>
    on
      ? "The outline joins the dots in order. It turns red when the shape folds over itself."
      : "Outline hidden. The dots still count in the same order.",
};
