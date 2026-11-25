// Page chrome only: marks the nav link of the section on screen, and fades
// sections in as they scroll into view.
(() => {
  if (!("IntersectionObserver" in window)) return;

  // Nav: a section is "current" while it crosses a band near the top of the screen.
  const links = [...document.querySelectorAll(".site-nav a")];
  const navObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const link of links) link.classList.toggle("is-current", link.hash === "#" + entry.target.id);
      }
    },
    { rootMargin: "-30% 0px -60% 0px" }
  );
  for (const link of links) {
    const section = link.hash && document.querySelector(link.hash); // links without a #section are skipped
    if (section) navObserver.observe(section);
  }

  // Reveal: each element animates in every time it comes onto the screen, and
  // resets once it has left, so scrolling back down plays it again.
  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) entry.target.classList.toggle("is-visible", entry.isIntersecting);
    },
    { rootMargin: "0px 0px -8% 0px" }
  );
  for (const el of document.querySelectorAll(".reveal-on-scroll, .grow-on-scroll")) revealObserver.observe(el);
})();