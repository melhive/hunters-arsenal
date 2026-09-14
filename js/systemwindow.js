/* System Window — the holographic HUD popup used for level-ups, quest
   completions, rank-ups, perfect days, and title unlocks. Queued so only
   one shows at a time. Pure UI module — callers decide *when* to show one. */

const SystemWindow = (function () {
  let queue = [];
  let showing = false;

  function root() {
    return document.getElementById('system-window-root');
  }

  function iconSVG(id) {
    return `<svg class="sw-icon"><use href="#${id}"></use></svg>`;
  }

  function show(opts) {
    queue.push(opts);
    if (!showing) advance();
  }

  function advance() {
    if (queue.length === 0) { showing = false; return; }
    showing = true;
    render(queue.shift());
  }

  function render(opts) {
    const r = root();
    if (!r) { advance(); return; }
    r.innerHTML = '';

    const box = document.createElement('div');
    box.className = 'sw-box sw-type-' + (opts.type || 'default');

    const linesHTML = (opts.lines || []).map(l => `<div class="sw-line">${l}</div>`).join('');
    const hasActions = opts.actions && opts.actions.length > 0;

    box.innerHTML = `
      <div class="sw-scanline"></div>
      <div class="sw-header">
        <span class="sw-dot"></span>
        <span class="sw-label">SYSTEM</span>
        <button class="sw-close" aria-label="Dismiss">&times;</button>
      </div>
      <div class="sw-content">
        ${opts.icon ? `<div class="sw-icon-wrap">${iconSVG(opts.icon)}</div>` : ''}
        <div class="sw-text">
          <div class="sw-title">${opts.title || ''}</div>
          <div class="sw-lines">${linesHTML}</div>
        </div>
      </div>
      ${hasActions ? `<div class="sw-actions"></div>` : `<div class="sw-progress"><div class="sw-progress-fill"></div></div>`}
    `;

    r.appendChild(box);

    let dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      box.classList.remove('sw-show');
      box.classList.add('sw-hide');
      setTimeout(() => { box.remove(); advance(); }, 260);
    }

    box.querySelector('.sw-close').addEventListener('click', dismiss);

    if (hasActions) {
      const actionsEl = box.querySelector('.sw-actions');
      opts.actions.forEach(a => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm' + (a.primary ? ' btn-primary' : ' btn-ghost');
        btn.textContent = a.label;
        btn.addEventListener('click', () => { if (a.onClick) a.onClick(); dismiss(); });
        actionsEl.appendChild(btn);
      });
    } else {
      const duration = opts.duration || 4200;
      const fill = box.querySelector('.sw-progress-fill');
      requestAnimationFrame(() => {
        fill.style.transitionDuration = duration + 'ms';
        fill.style.width = '0%';
      });
      setTimeout(dismiss, duration);
    }

    requestAnimationFrame(() => requestAnimationFrame(() => {
      box.classList.add('sw-show');
      if (opts.type === 'levelup' || opts.type === 'rankup') {
        if (typeof Effects !== 'undefined') Effects.celebrateTop();
      }
    }));
  }

  return { show };
})();
