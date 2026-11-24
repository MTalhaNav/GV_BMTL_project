
# Perspective Scanner

An interactive document scanner that demonstrates the mathematics behind perspective correction and digital image processing.

Developed by **Team BMTL** for the **CIS GV Hackathon 2026**.

## Features
- **Perspective Correction:** Flatten a tilted document by adjusting its four corners.
- **Grayscale:** Convert the image into shades of grey.
- **Black and White:** Convert the image into black and white with stronger contrast.
- **Enhance:** Improve the image's colours and overall appearance.
- **Plain Crop:** Compare perspective correction with a simple crop.
- **Forward Mapping:** Explore the difference between forward and backward mapping.
- **Magnifier:** Zoom in on the document's corners.
- **Outline:** Display the document boundaries and selected corners.
- **Pixel Tracing:** Explore how pixels are mapped between the original and corrected images.
- **Matrix Visualisation:** See the mathematical calculations behind the transformation.


## How It Works
A photograph taken at an angle makes a rectangular document appear distorted. The scanner corrects this using a mathematical technique called **homography**.

1. **Selecting the document:** Four points are placed on the corners of the document, forming a quadrilateral.
2. **Building the equations:** Each corner provides two equations, giving a system of eight equations with eight unknowns.
3. **Solving the matrix:** Gaussian elimination solves the equations to calculate the homography matrix, which describes the perspective transformation.
4. **Mapping the pixels:** The scanner uses backward mapping to find the corresponding position of each pixel in the original photograph.
5. **Calculating pixel colours:** Bilinear interpolation samples neighbouring pixels to calculate the colour at each position, helping produce a smoother result.
6. **Processing the image:** The flattened image can then be modified using grayscale, black-and-white and other available image-processing options.

The result is a rectangular image of the document, with the perspective distortion corrected.

## Privacy

Images are processed directly in the browser. Uploaded photographs are not sent to an external server.
