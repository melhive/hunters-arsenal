/* Visual effects — confetti bursts and checkbox micro-interactions.
   Pure DOM/canvas helpers, no dependencies. */

const Effects = (function () {

  // Short-lived canvas confetti burst, used for level-ups and rank-ups.
  function burstConfetti(originX, originY, count) {
    count = count || 28;
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    document.body.appendChild(canvas);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const colors = ['#7cd45e', '#9ce882', '#e8a33d', '#ffd27a', '#5eb1e8'];
    let particles = Array.from({ length: count }, () => ({
      x: originX,
      y: originY,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 7 - 3,
      size: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vr: (Math.random() - 0.5) * 14,
      life: 1,
      decay: Math.random() * 0.008 + 0.010
    }));

    let start = null;
    function frame(ts) {
      if (!start) start = ts;
      const elapsed = ts - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      particles.forEach(p => {
        p.vy += 0.22; // gravity
        p.vx *= 0.995; // air drag
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vr;
        p.life -= p.decay;

        ctx.save();
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      particles = particles.filter(p => p.life > 0 && p.y < window.innerHeight + 40);

      if (particles.length > 0 && elapsed < 2600) {
        requestAnimationFrame(frame);
      } else {
        canvas.remove();
      }
    }
    requestAnimationFrame(frame);
  }

  // Confetti from the top-center of the screen, roughly where the System Window appears.
  function celebrateTop() {
    burstConfetti(window.innerWidth / 2, 70, 30);
  }

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

  return { burstConfetti, celebrateTop, celebrateCheck, staggerChildren };
})();
