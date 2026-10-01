/* Visual effects — checkbox micro-interactions.
   Pure DOM/canvas helpers, no dependencies. */

const Effects = (function () {

  // Bounce + ripple + card-flash feedback when a habit is checked off.
  // `checkboxEl` is the small circular button; `cardEl` (optional) is the
  // containing habit-item/row for the sweep highlight.
  function celebrateCheck(checkboxEl, cardEl) {
    if (!checkboxEl) return;

    checkboxEl.classList.remove('just-checked');
    void checkboxEl.offsetWidth; // force reflow so the animation restarts
    checkboxEl.classList.add('just-checked');

    const ring = document.createElement('span');
    ring.className = 'ripple-ring';
    checkboxEl.appendChild(ring);
    setTimeout(() => ring.remove(), 600);

    if (cardEl) {
      cardEl.classList.remove('flash');
      void cardEl.offsetWidth;
      cardEl.classList.add('flash');
      setTimeout(() => cardEl.classList.remove('flash'), 650);
    }
  }

  // Apply a staggered fade-in to a container's direct children.
  // Only call this on fresh view entry, not on every re-render — replaying
  // it after each toggle would feel repetitive rather than delightful.
  function staggerChildren(container, delayStep) {
    if (!container) return;
    delayStep = delayStep || 40;
    Array.from(container.children).forEach((child, i) => {
      child.classList.add('stagger-item');
      child.style.animationDelay = (i * delayStep) + 'ms';
    });
  }

  return { celebrateCheck, staggerChildren };
})();
