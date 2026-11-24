
# Perspective Scanner

Ever take a photo of a document at an angle and it looks squashed and skewed? This project fixes exactly that and shows you the maths while it does the magic. Drag the four dots onto the corners of the page and watch a flat scan appear.

Developed by **Team BMTL** for the **CIS GV Hackathon 2026**.

## Features
- **Perspective Correction:** Drag the four corners onto your page and it gets flattened out.
- **Grayscale:** Convert the image into shades of grey.
- **Black and White:** Convert the image into black and white with stronger contrast.
- **Enhance:** Improve the image's colours and overall appearance.
- **Plain Crop:** Perspective correction compared to a simple crop.
- **Forward Mapping:** Shows the difference between forward and backward mapping.
- **Magnifier:** Zoom in on the document's corners.
- **Pixel Tracing:** Hhover over the scan to see where a pixel came from in the photo.
- **Matrix view:** Sshows the numbers behind the transform, updating as you move the dots.


## How It Works
When you take a picture of a page from an angle, it no longer looks like a rectangle. Instead, it looks like a distorted shape. A perspective transform fixes this by turning the shape back into a rectangle. The mathematical process behind this is called a **homography**.

1. You place four dots on the corners of the page.
2. Each corner gives two equations (one for x, one for y), so four corners give eight equations for eight unknown numbers.
3. **Solving the matrix:** Gaussian elimination solves the equations to calculate the homography matrix, which describes the perspective transformation.
4. For every pixel in the flat scan, the matrix tells us where to look in the original photo. We go backwards like this on purpose. Pushing photo pixels forward leaves holes in the result.
5. The spot we land on usually falls between pixels, so we blend the four nearest ones (bilinear interpolation) to get a smooth colour.
6. Greyscale, black and white and Enhance are applied last, pixel by pixel, and don't change the shape of the page.

## Privacy

Images are processed directly in the browser. Uploaded photographs are not sent to an external server.

<sub>We used AI to help with our code and to talk through and flesh out our logic.</sub>
