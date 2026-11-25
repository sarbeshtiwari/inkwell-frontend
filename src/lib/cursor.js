// The portfolio's ink cursor: six coloured blobs chase the pointer, each a little slower, smaller and softer than
// the one before. Only for mouse/trackpad users who haven't asked for reduced motion; the real cursor stays visible.
const BLOBS = [[18, "var(--tomato)", 1], [14, "var(--marigold)", .85], [11, "var(--rose)", .7], [9, "var(--lake)", .55], [7, "var(--sage)", .45], [5, "var(--grape)", .35]];

export function startInkCursor() {
  if (typeof window === "undefined" || matchMedia("(pointer: coarse)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const box = document.createElement("div");
  box.className = "blob-cursor"; box.setAttribute("aria-hidden", "true");
  const dots = BLOBS.map(([size, color, op]) => {
    const i = document.createElement("i");
    Object.assign(i.style, { width: size + "px", height: size + "px", background: color, opacity: op, marginLeft: -size / 2 + "px", marginTop: -size / 2 + "px" });
    box.appendChild(i); return i;
  });
  document.body.appendChild(box);
  const target = { x: innerWidth / 2, y: innerHeight / 2 }, pts = BLOBS.map(() => ({ ...target }));
  let hidden = true, frame = 0, last = performance.now();
  const move = e => { target.x = e.clientX; target.y = e.clientY; if (hidden) { hidden = false; box.style.opacity = 1; } };
  const leave = () => { hidden = true; box.style.opacity = 0; };
  addEventListener("mousemove", move, { passive: true }); document.addEventListener("mouseleave", leave);
  box.style.opacity = 0;
  const tick = now => {
    const dt = Math.min(60, Math.max(0, now - last)); last = now;
    pts.forEach((p, i) => {
      const lead = i ? pts[i - 1] : target, k = 1 - Math.exp(-(0.022 - 0.0025 * i) * dt);
      p.x += (lead.x - p.x) * k; p.y += (lead.y - p.y) * k;
      dots[i].style.transform = `translate(${p.x}px, ${p.y}px)`;
    });
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(frame); removeEventListener("mousemove", move); document.removeEventListener("mouseleave", leave); box.remove(); };
}
