// The story steps sit left and right like stops on a map. This draws the dashed
// route that winds from one numbered stop to the next.
(() => {
  const lists = [...document.querySelectorAll(".story-path")];
  if (!lists.length) return;

  function draw(list) {
    const svg = list.querySelector(".map-route");
    const path = svg.querySelector("path");
    const box = list.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);

    // Centre of each numbered stop, relative to the list.
    const stops = [...list.querySelectorAll(".story-no")].map((el) => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
    });
    if (stops.length < 2) return;

    // A smooth S-bend between each pair: leave one stop going straight down,
    // arrive at the next coming straight down.
    let d = `M${stops[0][0]} ${stops[0][1]}`;
    for (let i = 1; i < stops.length; i++) {
      const [x0, y0] = stops[i - 1];
      const [x1, y1] = stops[i];
      const bend = (y1 - y0) * 0.55;
      d += ` C${x0} ${y0 + bend} ${x1} ${y1 - bend} ${x1} ${y1}`;
    }
    path.setAttribute("d", d);
    // Used by the CSS that draws the route in as you scroll.
    list.style.setProperty("--route-length", Math.ceil(path.getTotalLength()));
  }

  const drawAll = () => lists.forEach(draw);
  const observer = new ResizeObserver(drawAll);
  lists.forEach((list) => observer.observe(list));
  document.addEventListener("toggle", drawAll, true); // a "Read more" opened or closed
  drawAll();
})();
