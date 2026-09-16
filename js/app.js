/* Hunter's Arsenal — main application logic (vanilla JS, no build step). */

(function () {
  'use strict';

  const ICONS = [
    'ic-water-glass', 'ic-droplet', 'ic-book', 'ic-dumbbell', 'ic-run', 'ic-moon',
    'ic-apple', 'ic-pill', 'ic-sun', 'ic-spa', 'ic-leaf', 'ic-target',
    'ic-pencil', 'ic-code', 'ic-lightbulb', 'ic-music', 'ic-palette', 'ic-heart',
    'ic-ban', 'ic-phone-off', 'ic-bike', 'ic-star', 'ic-smile', 'ic-flame', 'ic-shield', 'ic-trophy'
  ];
  const COLORS = ['#7cd45e', '#e8a33d', '#5eb1e8', '#e8636c', '#c78ce8', '#e8d95e', '#5ee8c7', '#e88fc5'];
  const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MAX_FREEZES = 3;
  const PERFECT_DAY_BASE_BONUS = 15;
  const PENALTY_PER_MISS = 8;
  const PENALTY_CAP = 30; // per day, however many habits were missed

  const ACHIEVEMENTS = [
    { id: 'first-blood', name: 'First Blood', desc: 'Complete your first habit', icon: 'ic-flame', check: ctx => ctx.totalCompletions >= 1 },
    { id: 'week-warrior', name: 'Week Warrior', desc: '7 perfect days total', icon: 'ic-shield', check: ctx => ctx.perfectDaysCount >= 7 },
    { id: 'centurion', name: 'Centurion', desc: '100 total completions', icon: 'ic-trophy', check: ctx => ctx.totalCompletions >= 100 },
    { id: 'iron-will', name: 'Iron Will', desc: '30-day streak on one habit', icon: 'ic-star', check: ctx => ctx.maxLongestStreak >= 30 },
    { id: 'rising-legend', name: 'Rising Legend', desc: 'Reach Elite rank on a habit', icon: 'ic-trophy', check: ctx => ctx.hasEliteRank },
    { id: 'renaissance', name: 'Renaissance Hunter', desc: 'Earn XP in all 5 stats', icon: 'ic-star', check: ctx => ctx.statsCovered >= 5 },
    { id: 'perfectionist', name: 'Perfectionist', desc: '10 perfect days total', icon: 'ic-flame', check: ctx => ctx.perfectDaysCount >= 10 },
    { id: 'guardian', name: 'Guardian', desc: 'Use a streak freeze', icon: 'ic-shield', check: ctx => ctx.frozenDatesCount >= 1 },
    { id: 's-rank-hunter', name: 'S-Rank Hunter', desc: 'Reach S-Rank', icon: 'ic-trophy', check: ctx => ctx.hunterRank === 'S' }
  ];

  let state = {
    view: 'dashboard',
    weekOffset: 0,
    editingHabitId: null,
    selectedIcon: ICONS[0],
    selectedColor: COLORS[0],
    selectedDays: [1, 2, 3, 4, 5],
    selectedStat: Gamify.DEFAULT_STAT,
    animateDashboard: false,
    animateProfile: false
  };

  /* ---------- Utilities ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return Store.todayISO(d);
  }
  function startOfWeek(iso) {
    const d = new Date(iso + 'T00:00:00');
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return Store.todayISO(d);
  }
  function formatDateLabel(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }
  function showToast(msg, action) {
    const t = $('#toast');
    const actionBtn = $('#toast-action');
    $('#toast-msg').textContent = msg;
    clearTimeout(showToast._timer);

    if (action) {
      actionBtn.textContent = action.label;
      actionBtn.style.display = 'inline';
      actionBtn.onclick = () => {
        action.onClick();
        t.classList.remove('show');
      };
    } else {
      actionBtn.style.display = 'none';
      actionBtn.onclick = null;
    }

    t.classList.add('show');
    const duration = action ? 4500 : 2200;
    showToast._timer = setTimeout(() => t.classList.remove('show'), duration);
  }
  function iconSVG(iconId, extraStyle) {
    return `<svg class="icon"${extraStyle ? ` style="${extraStyle}"` : ''}><use href="#${iconId}"></use></svg>`;
  }
  function hexAlpha(hex, alpha) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16), g = parseInt(c.substring(2, 4), 16), b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  function escapeHTML(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ---------- Theme ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    $('#theme-btn-dark').classList.toggle('active', theme === 'dark');
    $('#theme-btn-light').classList.toggle('active', theme === 'light');
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#12151a' : '#f2f1ec');
  }
  function initTheme() {
    const saved = Store.getSettings().theme;
    const theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    applyTheme(theme);
  }
  function setTheme(theme) {
    const settings = Store.getSettings();
    settings.theme = theme;
    Store.saveSettings(settings);
    applyTheme(theme);
  }

  /* ---------- Sound ---------- */
  function initSound() {
    const settings = Store.getSettings();
    if (typeof Sound !== 'undefined') Sound.setEnabled(settings.sound === true);
  }
  function setSoundEnabled(v) {
    const settings = Store.getSettings();
    settings.sound = v;
    Store.saveSettings(settings);
    if (typeof Sound !== 'undefined') Sound.setEnabled(v);
  }

  /* ---------- Navigation ---------- */
  function switchView(view) {
    if (typeof Sound !== 'undefined') Sound.click();
    state.view = view;
    $all('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
    $all('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    if (view === 'dashboard') { state.animateDashboard = true; renderDashboard(); }
    if (view === 'history') renderHistory();
    if (view === 'stats') renderStats();
    if (view === 'profile') { state.animateProfile = true; renderProfile(); }
    if (view === 'settings') renderArchivedList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function initNav() {
    $all('.nav-item').forEach(item => {
      item.addEventListener('click', () => switchView(item.dataset.view));
    });
  }

  /* ---------- Shared gamification snapshot ---------- */
  function snapshot(habitId) {
    const habits = Store.getHabits();
    const logs = Store.getLogs();
    const perfectDays = Store.getPerfectDays();
    const penalties = Store.getPenalties();
    const xp = Gamify.totalXP(logs, perfectDays, penalties);
    const level = Gamify.levelFromXP(xp).level;
    const hunterRank = Gamify.rankForLevel(level).id;
    const habit = habits.find(h => h.id === habitId);
    const habitRank = habit ? Gamify.rankFor(Gamify.countCompletions(habit.id, logs)) : null;
    return { xp, level, hunterRank, habitRankName: habitRank ? habitRank.name : null };
  }

  // The single entry point for marking a habit done/undone anywhere in the app.
  // Handles XP/level, Hunter Rank-ups, per-habit mastery rank-ups, the
  // perfect-day combo, streak freezes earned, and achievement unlocks — all
  // via queued System Window popups (+ sound, when enabled).
  function performToggle(habitId, dateISO) {
    const before = snapshot(habitId);
    const wasDone = Store.isDone(habitId, dateISO);
    // XP is snapshotted using the rank BEFORE this completion — see
    // Gamify.xpForCompletion's comment on why this must never be recomputed later.
    const xpValue = wasDone ? undefined : Gamify.xpForCompletion(before.level);
    const nowDone = Store.toggle(habitId, dateISO, xpValue);

    const habits = Store.getHabits();
    const logs = Store.getLogs();
    const habit = habits.find(h => h.id === habitId);
    const after = snapshot(habitId);

    if (nowDone && habit) {
      if (typeof Sound !== 'undefined') Sound.checkOff();

      if (after.hunterRank !== before.hunterRank) {
        const rankInfo = Gamify.HUNTER_RANKS.find(r => r.id === after.hunterRank);
        SystemWindow.show({
          type: 'rankup', icon: 'ic-trophy', title: `RANK UP! \u2192 ${rankInfo.label}`,
          lines: [`You are now ${rankInfo.label}. Every quest is worth more XP.`]
        });
        if (typeof Sound !== 'undefined') Sound.rankUp();
      } else if (after.level > before.level) {
        SystemWindow.show({
          type: 'levelup', icon: 'ic-star', title: `LEVEL UP! \u2192 LV ${after.level}`,
          lines: [`Your hunter reached Level ${after.level}.`]
        });
        if (typeof Sound !== 'undefined') Sound.levelUp();
      }

      if (after.habitRankName && after.habitRankName !== before.habitRankName) {
        const rank = Gamify.rankFor(Gamify.countCompletions(habit.id, logs));
        SystemWindow.show({
          type: 'rankup', icon: rank.icon, title: `${escapeHTML(habit.name)}: ${rank.name}`,
          lines: [`This habit ranked up to ${rank.name}.`]
        });
      }
      handlePerfectDayCheck(dateISO);
    } else if (!nowDone) {
      if (typeof Sound !== 'undefined') Sound.uncheck();
      // Unchecking might undo a day that was previously marked perfect.
      const perfectDays = Store.getPerfectDays();
      if (perfectDays[dateISO] !== undefined && !Gamify.isPerfectDay(Store.getActiveHabits(), logs, dateISO)) {
        Store.clearPerfectDay(dateISO);
      }
    }

    checkAchievements();
    return nowDone;
  }

  function handlePerfectDayCheck(dateISO) {
    const habits = Store.getActiveHabits();
    const logs = Store.getLogs();
    const perfectDays = Store.getPerfectDays();
    const alreadyRecorded = perfectDays[dateISO] !== undefined;
    if (alreadyRecorded) return;
    if (!Gamify.isPerfectDay(habits, logs, dateISO)) return;

    const frozenDates = Store.getFrozenDates();
    const streak = Gamify.perfectDayStreak(habits, logs, frozenDates, { ...perfectDays, [dateISO]: 1 }, Store.todayISO());
    const bonus = PERFECT_DAY_BASE_BONUS + Math.min(streak, 10) * 5;
    Store.setPerfectDay(dateISO, bonus);

    const lines = [`Every scheduled habit complete. +${bonus} bonus XP.`, `Combo streak: ${streak} day${streak === 1 ? '' : 's'}.`];

    let freezeAwarded = false;
    if (streak > 0 && streak % 7 === 0) {
      const current = Store.getFreezeCount();
      if (current < MAX_FREEZES) {
        Store.setFreezeCount(current + 1);
        freezeAwarded = true;
        lines.push(`+1 Streak Freeze earned! (${current + 1}/${MAX_FREEZES})`);
      }
    }

    SystemWindow.show({
      type: 'rankup', icon: 'ic-flame', title: 'PERFECT DAY!',
      lines
    });
    if (typeof Sound !== 'undefined') Sound.perfectDay();
  }

  function checkAchievements() {
    const habits = Store.getHabits();
    const logs = Store.getLogs();
    const perfectDays = Store.getPerfectDays();
    const penalties = Store.getPenalties();
    const unlocked = Store.getAchievements();

    const totalCompletions = Object.values(logs).reduce((s, day) => s + Object.keys(day).length, 0);
    const perfectDaysCount = Object.keys(perfectDays).length;
    const maxLongestStreak = habits.reduce((max, h) => Math.max(max, Gamify.longestStreak(h, logs)), 0);
    const hasEliteRank = habits.some(h => Gamify.countCompletions(h.id, logs) >= 100);
    const statTotals = Gamify.statTotals(logs, habits);
    const statsCovered = Object.values(statTotals).filter(v => v > 0).length;
    const frozenDatesCount = Store.getFrozenDates().length;
    const currentXP = Gamify.totalXP(logs, perfectDays, penalties);
    const hunterRank = Gamify.rankForLevel(Gamify.levelFromXP(currentXP).level).id;

    const ctx = { totalCompletions, perfectDaysCount, maxLongestStreak, hasEliteRank, statsCovered, frozenDatesCount, hunterRank };

    ACHIEVEMENTS.forEach(a => {
      if (unlocked.includes(a.id)) return;
      if (a.check(ctx)) {
        Store.unlockAchievement(a.id);
        if (!Store.getEquippedTitle()) Store.setEquippedTitle(a.id);
        SystemWindow.show({
          type: 'rankup', icon: a.icon, title: 'TITLE UNLOCKED',
          lines: [`"${a.name}" — ${a.desc}`]
        });
        if (typeof Sound !== 'undefined') Sound.achievement();
      }
    });
  }

  // Offer a streak freeze if yesterday broke a perfect-day combo. Asked once per date.
  function checkFreezeOffer() {
    const today = Store.todayISO();
    const yesterday = addDays(today, -1);
    const habits = Store.getActiveHabits();
    const logs = Store.getLogs();
    const scheduled = habits.filter(h => Gamify.isScheduledForDate(h, yesterday));
    if (scheduled.length === 0) return;
    if (Gamify.isPerfectDay(habits, logs, yesterday)) return;
    if (Store.getFrozenDates().includes(yesterday)) return;
    if (Store.getFreezePrompted().includes(yesterday)) return;

    const freezes = Store.getFreezeCount();
    if (freezes <= 0) { Store.markFreezePrompted(yesterday); return; }

    SystemWindow.show({
      type: 'default', icon: 'ic-shield', title: 'Streak Freeze Available',
      lines: ['You missed a perfect day yesterday.', 'Spend a freeze to protect your combo?'],
      actions: [
        { label: 'Use Freeze', primary: true, onClick: () => {
          Store.addFrozenDate(yesterday);
          Store.setFreezeCount(Store.getFreezeCount() - 1);
          Store.markFreezePrompted(yesterday);
          Store.setPenalty(yesterday, 0); // a freeze excuses any penalty for that day too
          renderDashboard();
          showToast('Streak freeze used');
        } },
        { label: 'No thanks', onClick: () => { Store.markFreezePrompted(yesterday); } }
      ]
    });
  }

  // Missing a scheduled habit (without a streak freeze covering that day)
  // costs a small, flat, non-escalating amount of XP — a light touch, not a
  // spiral. Can be turned off entirely in Settings.
  function checkDailyPenalty() {
    const settings = Store.getSettings();
    if (settings.penaltiesEnabled === false) return;

    const today = Store.todayISO();
    const yesterday = addDays(today, -1);
    if (Store.getPenaltyProcessed().includes(yesterday)) return;
    Store.markPenaltyProcessed(yesterday); // only ever evaluate a given date once

    const habits = Store.getActiveHabits();
    const logs = Store.getLogs();
    const scheduled = habits.filter(h => Gamify.isScheduledForDate(h, yesterday));
    if (scheduled.length === 0) return;
    if (Store.getFrozenDates().includes(yesterday)) return;

    const missed = scheduled.filter(h => !Store.isDone(h.id, yesterday));
    if (missed.length === 0) return;

    const amount = Math.min(missed.length * PENALTY_PER_MISS, PENALTY_CAP);
    Store.setPenalty(yesterday, amount);

    setTimeout(() => {
      SystemWindow.show({
        type: 'penalty', icon: 'ic-ban', title: 'PENALTY QUEST ISSUED',
        lines: [`${missed.length} quest${missed.length === 1 ? '' : 's'} went unfinished yesterday.`, `\u2212${amount} XP`]
      });
      if (typeof Sound !== 'undefined') Sound.penalty();
      renderDashboard();
    }, 900);
  }

  /* ---------- Dashboard ---------- */
  function renderDashboard() {
    const today = Store.todayISO();
    $('#dashboard-date').textContent = formatDateLabel(today);

    const habits = Store.getActiveHabits();
    const logs = Store.getLogs();
    const perfectDays = Store.getPerfectDays();
    const penalties = Store.getPenalties();
    const scheduled = habits.filter(h => Gamify.isScheduledForDate(h, today));

    const doneCount = scheduled.filter(h => Store.isDone(h.id, today)).length;
    const pct = scheduled.length ? Math.round((doneCount / scheduled.length) * 100) : 0;
    $('#hero-today-pct').textContent = pct + '% today';

    const xp = Gamify.totalXP(logs, perfectDays, penalties);
    const lvl = Gamify.levelFromXP(xp);
    const hunterRank = Gamify.rankForLevel(lvl.level);
    $('#hero-level').textContent = lvl.level;
    $('#hero-xp-label').textContent = `${lvl.into} / ${lvl.needed} XP`;
    $('#hero-xp-fill').style.width = Math.round(lvl.progress * 100) + '%';
    const rankBadge = $('#hero-rank-badge');
    if (rankBadge) {
      rankBadge.textContent = hunterRank.label;
      rankBadge.style.setProperty('--rank-color', hunterRank.color);
      rankBadge.style.setProperty('--rank-bg', hexAlpha(hunterRank.color, 0.14));
    }

    const equippedId = Store.getEquippedTitle();
    const equipped = ACHIEVEMENTS.find(a => a.id === equippedId);
    const titleChip = $('#hero-title-chip');
    if (equipped) { titleChip.style.display = 'inline-flex'; titleChip.textContent = equipped.name.toUpperCase(); }
    else titleChip.style.display = 'none';

    const frozenDates = Store.getFrozenDates();
    const comboStreak = Gamify.perfectDayStreak(habits, logs, frozenDates, perfectDays, today);
    $('#hero-combo-count').textContent = comboStreak;
    $('#hero-freeze-count').textContent = Store.getFreezeCount();

    const list = $('#dashboard-list');
    list.innerHTML = '';

    if (habits.length === 0) {
      list.appendChild(emptyState('ic-shield', 'Your arsenal is empty', 'Add your first habit with the + button to start tracking.'));
      return;
    }
    if (scheduled.length === 0) {
      list.appendChild(emptyState('ic-moon', 'Nothing scheduled today', 'Enjoy your day off, or add a new habit.'));
      return;
    }

    scheduled.forEach(h => {
      const done = Store.isDone(h.id, today);
      const rank = Gamify.rankFor(Gamify.countCompletions(h.id, logs));
      const streak = Gamify.currentStreak(h, logs, today);
      const xpValue = Gamify.xpForCompletion(lvl.level);
      const item = el('div', 'habit-item' + (done ? ' done' : ''));
      item.dataset.habitId = h.id;
      item.innerHTML = `
        <button class="icon-btn drag-handle" title="Drag to reorder" aria-label="Drag to reorder">${iconSVG('ic-grip')}</button>
        <button class="habit-checkbox" aria-label="Mark done">${checkboxGlyph()}</button>
        <div class="habit-icon" style="background:${hexAlpha(h.color, 0.16)}; color:${h.color}">${iconSVG(h.icon)}</div>
        <div class="habit-main">
          <div class="habit-name">${escapeHTML(h.name)}</div>
          <div class="habit-meta">
            <span class="xp-chip">+${xpValue} XP</span>
            <span class="rank-chip">${iconSVG(rank.icon)} ${rank.name}</span>
            ${streak > 0 ? `<span class="streak-chip">${iconSVG('ic-flame')} ${streak}d</span>` : ''}
          </div>
        </div>
        <div class="habit-actions">
          <button class="icon-btn edit-habit-btn" title="Edit">${iconSVG('ic-pencil')}</button>
        </div>
      `;
      const checkboxEl = item.querySelector('.habit-checkbox');
      checkboxEl.addEventListener('click', () => {
        if (!done) {
          Effects.celebrateCheck(checkboxEl, item);
          setTimeout(() => { performToggle(h.id, today); renderDashboard(); }, 200);
        } else {
          performToggle(h.id, today);
          renderDashboard();
        }
      });
      item.querySelector('.edit-habit-btn').addEventListener('click', () => openHabitModal(h.id));
      list.appendChild(item);
    });

    if (state.animateDashboard) {
      Effects.staggerChildren(list);
      state.animateDashboard = false;
    }
  }

  /* ---------- Drag to reorder (Dashboard) ----------
     Uses Pointer Events (unifies mouse + touch) rather than the HTML5
     Drag and Drop API, which has poor touch support. During a drag we only
     move elements visually via CSS transform; the underlying order is
     committed to storage on drop, then the list re-renders from that order —
     so we never have to manipulate live DOM child order directly. */
  function initDragReorder() {
    const list = $('#dashboard-list');
    const GAP = 10; // must match .habit-list { gap } in CSS
    let drag = null;

    list.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('.drag-handle');
      if (!handle) return;
      const item = handle.closest('.habit-item');
      if (!item) return;
      e.preventDefault();

      const items = Array.from(list.querySelectorAll('.habit-item'));
      if (items.length < 2) return; // nothing to reorder

      const rects = items.map(it => it.getBoundingClientRect());
      const startIndex = items.indexOf(item);

      drag = { el: item, items, rects, startIndex, targetIndex: startIndex, startY: e.clientY, pointerId: e.pointerId };
      item.classList.add('dragging');
      items.forEach(it => { if (it !== item) it.style.transition = 'transform 0.18s ease'; });

      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    });

    function onMove(e) {
      if (!drag) return;
      const deltaY = e.clientY - drag.startY;
      drag.el.style.transform = `translateY(${deltaY}px)`;

      const draggedRect = drag.rects[drag.startIndex];
      const spacing = draggedRect.height + GAP;
      const draggedCenter = draggedRect.top + draggedRect.height / 2 + deltaY;

      // Swap triggers once the dragged card's center crosses the HALF-distance
      // midpoint toward a neighbor's original slot (standard, responsive
      // drag-reorder feel — not the neighbor's full original position).
      let net = 0;
      drag.items.forEach((it, i) => {
        if (i === drag.startIndex) return;
        const r = drag.rects[i];
        const otherCenter = r.top + r.height / 2;
        if (i > drag.startIndex) {
          if (draggedCenter > otherCenter - spacing / 2) net++;
        } else {
          if (draggedCenter < otherCenter + spacing / 2) net--;
        }
      });
      let targetIndex = drag.startIndex + net;
      targetIndex = Math.max(0, Math.min(drag.items.length - 1, targetIndex));
      drag.targetIndex = targetIndex;

      drag.items.forEach((it, i) => {
        if (i === drag.startIndex) return;
        let shift = 0;
        if (drag.startIndex < targetIndex) {
          if (i > drag.startIndex && i <= targetIndex) shift = -(draggedRect.height + GAP);
        } else if (drag.startIndex > targetIndex) {
          if (i >= targetIndex && i < drag.startIndex) shift = draggedRect.height + GAP;
        }
        it.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    }

    function onUp() {
      if (!drag) return;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);

      const { items, startIndex, targetIndex } = drag;
      items.forEach(it => { it.style.transform = ''; it.style.transition = ''; });
      drag.el.classList.remove('dragging');

      if (targetIndex !== startIndex) {
        const ids = items.map(it => it.dataset.habitId);
        const moved = ids.splice(startIndex, 1)[0];
        ids.splice(targetIndex, 0, moved);
        Store.reorderHabits(ids);
      }
      drag = null;
      renderDashboard();
    }
  }

  function checkboxGlyph() {
    return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12.5 9.5 18 20 6"></polyline></svg>`;
  }

  function emptyState(icon, title, desc) {
    const e = el('div', 'empty-state');
    e.innerHTML = `<div class="es-icon">${iconSVG(icon, 'width:34px;height:34px;color:var(--text-faint)')}</div><h3>${title}</h3><p>${desc}</p>`;
    return e;
  }

  /* ---------- History ---------- */
  function renderHistory() {
    const today = Store.todayISO();
    const weekStart = addDays(startOfWeek(today), state.weekOffset * 7);
    const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const weekEnd = weekDates[6];

    const startLbl = new Date(weekStart + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endLbl = new Date(weekEnd + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    $('#week-label').textContent = state.weekOffset === 0 ? `This week (${startLbl} – ${endLbl})` : `${startLbl} – ${endLbl}`;
    $('#week-next').disabled = state.weekOffset >= 0;
    $('#week-next').style.opacity = state.weekOffset >= 0 ? 0.4 : 1;

    const habits = Store.getActiveHabits();
    const logs = Store.getLogs();
    const table = $('#week-table');
    table.innerHTML = '';

    const thead = el('thead');
    const headRow = el('tr');
    headRow.appendChild(el('th', '', 'Habit'));
    weekDates.forEach(dISO => {
      const d = new Date(dISO + 'T00:00:00');
      const isToday = dISO === today;
      const th = el('th', isToday ? 'today-col' : '', `${DAY_LABELS[d.getDay()]}<br>${d.getDate()}`);
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => openDayModal(dISO));
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = el('tbody');
    if (habits.length === 0) {
      const tr = el('tr');
      const td = el('td', '', 'No habits yet');
      td.colSpan = 8;
      td.style.textAlign = 'center';
      td.style.padding = '30px';
      td.style.color = 'var(--text-muted)';
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    habits.forEach(h => {
      const tr = el('tr');
      const nameTd = el('td');
      nameTd.innerHTML = `<div class="week-habit-label" style="color:${h.color}">${iconSVG(h.icon)}<span style="color:var(--text)">${escapeHTML(h.name)}</span></div>`;
      tr.appendChild(nameTd);

      weekDates.forEach(dISO => {
        const td = el('td', dISO === today ? 'today-col' : '');
        const isScheduled = Gamify.isScheduledForDate(h, dISO);
        const isFuture = dISO > today;
        if (!isScheduled) {
          td.innerHTML = '<span style="color:var(--text-faint)">—</span>';
        } else {
          const done = Store.isDone(h.id, dISO);
          const btn = el('button', 'day-cell-btn' + (done ? ' done' : '') + (isFuture ? ' future' : ''));
          btn.innerHTML = checkboxGlyph();
          btn.disabled = isFuture;
          btn.addEventListener('click', () => {
            if (!done) {
              Effects.celebrateCheck(btn, null);
              setTimeout(() => { performToggle(h.id, dISO); renderHistory(); }, 200);
            } else {
              performToggle(h.id, dISO);
              renderHistory();
            }
          });
          td.appendChild(btn);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    renderHeatmap();
  }

  function openDayModal(dISO) {
    const habits = Store.getActiveHabits().filter(h => Gamify.isScheduledForDate(h, dISO));
    $('#day-modal-title').textContent = formatDateLabel(dISO);
    const list = $('#day-modal-list');
    list.innerHTML = '';
    const today = Store.todayISO();
    const isFuture = dISO > today;

    if (habits.length === 0) {
      list.appendChild(emptyState('ic-moon', 'Nothing scheduled', 'No habits were scheduled on this day.'));
    }
    habits.forEach(h => {
      const done = Store.isDone(h.id, dISO);
      const item = el('div', 'habit-item' + (done ? ' done' : ''));
      item.innerHTML = `
        <button class="habit-checkbox" ${isFuture ? 'disabled' : ''}>${checkboxGlyph()}</button>
        <div class="habit-icon" style="background:${hexAlpha(h.color, 0.16)}; color:${h.color}">${iconSVG(h.icon)}</div>
        <div class="habit-main"><div class="habit-name">${escapeHTML(h.name)}</div></div>
      `;
      if (!isFuture) {
        const cbEl = item.querySelector('.habit-checkbox');
        cbEl.addEventListener('click', () => {
          if (!done) {
            Effects.celebrateCheck(cbEl, item);
            setTimeout(() => { performToggle(h.id, dISO); openDayModal(dISO); renderHistory(); }, 200);
          } else {
            performToggle(h.id, dISO);
            openDayModal(dISO);
            renderHistory();
          }
        });
      }
      list.appendChild(item);
    });
    openModal('#day-modal');
  }

  /* ---------- Stats ---------- */
  function renderStats() {
    const habits = Store.getActiveHabits();
    const logs = Store.getLogs();
    const perfectDays = Store.getPerfectDays();
    const penalties = Store.getPenalties();
    const today = Store.todayISO();

    const totalCompletions = Object.values(logs).reduce((s, day) => s + Object.keys(day).length, 0);
    const xp = Gamify.totalXP(logs, perfectDays, penalties);
    const bestStreak = habits.reduce((max, h) => Math.max(max, Gamify.currentStreak(h, logs, today)), 0);
    const activeDays = Object.keys(logs).filter(d => Object.keys(logs[d]).length > 0).length;

    const tiles = $('#stats-tiles');
    tiles.innerHTML = '';
    [
      [totalCompletions, 'Total check-ins'],
      [xp, 'XP earned'],
      [bestStreak, 'Best active streak'],
      [activeDays, 'Active days']
    ].forEach(([num, label]) => {
      const t = el('div', 'bracket-card stat-tile');
      t.innerHTML = `<span class="bc-tr"></span><span class="bc-bl"></span><div class="stat-num">${num}</div><div class="stat-label">${label}</div>`;
      tiles.appendChild(t);
    });

    const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
    const values = days.map(dISO => {
      const scheduled = habits.filter(h => Gamify.isScheduledForDate(h, dISO));
      if (scheduled.length === 0) return 0;
      const done = scheduled.filter(h => Store.isDone(h.id, dISO)).length;
      return Math.round((done / scheduled.length) * 100);
    });
    drawBarChart($('#chart-30d'), days, values);

    const masteryList = $('#mastery-list');
    masteryList.innerHTML = '';
    if (habits.length === 0) {
      masteryList.appendChild(emptyState('ic-bar-chart', 'No data yet', 'Add and complete habits to see stats here.'));
    }
    habits.forEach(h => {
      const rank = Gamify.rankFor(Gamify.countCompletions(h.id, logs));
      const row = el('div', 'habit-mastery-row');
      row.innerHTML = `
        <div class="habit-icon" style="background:${hexAlpha(h.color, 0.16)}; color:${h.color}; width:32px; height:32px;">${iconSVG(h.icon)}</div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:5px;">
            <span style="font-weight:600;">${escapeHTML(h.name)}</span>
            <span class="rank-chip">${iconSVG(rank.icon)} ${rank.name}</span>
          </div>
          <div class="mastery-bar-track"><div class="mastery-bar-fill" style="width:${Math.round(rank.progress * 100)}%"></div></div>
        </div>
      `;
      masteryList.appendChild(row);
    });
  }

  function drawBarChart(canvas, dayISOs, values) {
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.parentElement.clientWidth - 36;
    const cssHeight = 150;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--accent').trim();
    const gridColor = styles.getPropertyValue('--border-soft').trim();
    const textColor = styles.getPropertyValue('--text-faint').trim();

    const padBottom = 20, padTop = 6;
    const chartH = cssHeight - padBottom - padTop;
    const barW = cssWidth / values.length;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    [0, 50, 100].forEach(pct => {
      const y = padTop + chartH - (pct / 100) * chartH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cssWidth, y);
      ctx.stroke();
    });

    values.forEach((v, i) => {
      const barH = (v / 100) * chartH;
      const x = i * barW + barW * 0.18;
      const w = barW * 0.64;
      const y = padTop + chartH - barH;
      ctx.fillStyle = v > 0 ? accent : gridColor;
      roundRect(ctx, x, y, w, Math.max(barH, 2), 2);
      ctx.fill();
    });

    ctx.fillStyle = textColor;
    ctx.font = '10px "Work Sans", sans-serif';
    ctx.textAlign = 'center';
    dayISOs.forEach((dISO, i) => {
      if (i % 6 !== 0) return;
      const d = new Date(dISO + 'T00:00:00');
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      ctx.fillText(label, i * barW + barW / 2, cssHeight - 5);
    });
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- Profile ---------- */
  function renderProfile() {
    const habits = Store.getHabits();
    const logs = Store.getLogs();
    const perfectDays = Store.getPerfectDays();
    const penalties = Store.getPenalties();
    const xp = Gamify.totalXP(logs, perfectDays, penalties);
    const lvl = Gamify.levelFromXP(xp);
    const hunterRank = Gamify.rankForLevel(lvl.level);
    $('#profile-level').textContent = lvl.level;
    const profileRank = $('#profile-rank');
    if (profileRank) {
      profileRank.textContent = hunterRank.label;
      profileRank.style.setProperty('--rank-color', hunterRank.color);
      profileRank.style.setProperty('--rank-bg', hexAlpha(hunterRank.color, 0.14));
    }

    const equippedId = Store.getEquippedTitle();
    const equipped = ACHIEVEMENTS.find(a => a.id === equippedId);
    $('#profile-title').textContent = equipped ? `"${equipped.name}"` : 'No title equipped yet';

    const totals = Gamify.statTotals(logs, habits);
    const maxVal = Math.max(1, ...Object.values(totals));
    const barsEl = $('#stat-bars');
    barsEl.innerHTML = '';
    Gamify.STATS.forEach(s => {
      const val = totals[s.id] || 0;
      const row = el('div', 'stat-row');
      row.innerHTML = `
        <div class="stat-icon-wrap">${iconSVG(s.icon)}</div>
        <div class="stat-row-main">
          <div class="stat-row-top"><b>${s.label}</b><span class="stat-val">${val} XP</span></div>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${Math.round((val / maxVal) * 100)}%"></div></div>
        </div>
      `;
      barsEl.appendChild(row);
    });

    const unlocked = Store.getAchievements();
    const grid = $('#achv-grid');
    grid.innerHTML = '';
    ACHIEVEMENTS.forEach(a => {
      const isUnlocked = unlocked.includes(a.id);
      const isEquipped = equippedId === a.id;
      const card = el('div', 'bracket-card achv-card' + (isUnlocked ? '' : ' locked') + (isEquipped ? ' equipped' : ''));
      card.innerHTML = `
        <span class="bc-tr"></span><span class="bc-bl"></span>
        <div class="achv-icon-wrap">${iconSVG(isUnlocked ? a.icon : 'ic-ban')}</div>
        <div class="achv-name">${a.name}</div>
        <div class="achv-desc">${a.desc}</div>
        ${isEquipped ? '<div class="achv-equipped-tag">EQUIPPED</div>' : ''}
      `;
      if (isUnlocked) {
        card.addEventListener('click', () => {
          Store.setEquippedTitle(isEquipped ? null : a.id);
          renderProfile();
          renderDashboard();
        });
      }
      grid.appendChild(card);
    });

    if (state.animateProfile) {
      Effects.staggerChildren(grid, 30);
      state.animateProfile = false;
    }
  }

  /* ---------- Habit modal ---------- */
  function buildPickers() {
    const iconGrid = $('#icon-grid');
    iconGrid.innerHTML = '';
    ICONS.forEach(iconId => {
      const b = el('button', 'icon-choice');
      b.type = 'button';
      b.innerHTML = iconSVG(iconId);
      b.addEventListener('click', () => {
        state.selectedIcon = iconId;
        $all('.icon-choice', iconGrid).forEach(x => x.classList.toggle('selected', x === b));
      });
      iconGrid.appendChild(b);
    });

    const swatches = $('#color-swatches');
    swatches.innerHTML = '';
    COLORS.forEach(color => {
      const b = el('button', 'swatch');
      b.type = 'button';
      b.style.background = color;
      b.addEventListener('click', () => {
        state.selectedColor = color;
        $all('.swatch', swatches).forEach(x => x.classList.toggle('selected', x === b));
      });
      swatches.appendChild(b);
    });

    const dayPicker = $('#day-picker');
    dayPicker.innerHTML = '';
    DAY_LABELS.forEach((lbl, idx) => {
      const b = el('button', 'day-toggle', lbl);
      b.type = 'button';
      b.title = DAY_FULL[idx];
      b.addEventListener('click', () => {
        const pos = state.selectedDays.indexOf(idx);
        if (pos >= 0) state.selectedDays.splice(pos, 1); else state.selectedDays.push(idx);
        b.classList.toggle('selected');
      });
      dayPicker.appendChild(b);
    });

    const statSelect = $('#habit-stat');
    statSelect.innerHTML = '';
    Gamify.STATS.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.label} (${s.id})`;
      statSelect.appendChild(opt);
    });
    statSelect.addEventListener('change', (e) => { state.selectedStat = e.target.value; });
  }

  function openHabitModal(habitId) {
    state.editingHabitId = habitId || null;
    const form = $('#habit-form');
    form.reset();
    $('#habit-modal-title').textContent = habitId ? 'Edit Habit' : 'New Habit';
    $('#habit-delete-btn').style.display = habitId ? 'inline-flex' : 'none';
    $('#habit-modal-footer-row').style.display = habitId ? 'flex' : 'none';

    let habit = null;
    if (habitId) habit = Store.getHabits().find(h => h.id === habitId);

    state.selectedIcon = habit ? habit.icon : ICONS[0];
    state.selectedColor = habit ? habit.color : COLORS[0];
    state.selectedDays = habit && habit.frequency.type === 'weekdays' ? [...habit.frequency.days] : [1, 2, 3, 4, 5];
    state.selectedStat = habit ? (habit.stat || Gamify.DEFAULT_STAT) : Gamify.DEFAULT_STAT;

    $all('.icon-choice').forEach(b => b.classList.toggle('selected', b.querySelector('use').getAttribute('href').endsWith('#' + state.selectedIcon)));
    $all('.swatch').forEach(b => b.classList.toggle('selected', b.style.background === hexToRgbStr(state.selectedColor)));
    $all('.day-toggle').forEach((b, idx) => b.classList.toggle('selected', state.selectedDays.includes(idx)));
    $('#habit-stat').value = state.selectedStat;

    $('#habit-name').value = habit ? habit.name : '';
    $('#habit-frequency').value = habit ? habit.frequency.type : 'daily';
    $('#days-field').style.display = $('#habit-frequency').value === 'weekdays' ? 'block' : 'none';

    openModal('#habit-modal');
    setTimeout(() => $('#habit-name').focus(), 350);
  }
  function hexToRgbStr(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16), g = parseInt(c.substring(2, 4), 16), b = parseInt(c.substring(4, 6), 16);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function saveHabitForm(e) {
    e.preventDefault();
    const name = $('#habit-name').value.trim();
    if (!name) return;
    const freqType = $('#habit-frequency').value;
    const frequency = freqType === 'weekdays'
      ? { type: 'weekdays', days: state.selectedDays.length ? state.selectedDays : [1, 2, 3, 4, 5] }
      : { type: 'daily' };

    const payload = {
      name,
      icon: state.selectedIcon,
      color: state.selectedColor,
      stat: state.selectedStat,
      frequency
    };

    if (state.editingHabitId) {
      Store.updateHabit(state.editingHabitId, payload);
      showToast('Habit updated');
    } else {
      Store.addHabit(payload);
      showToast('Habit added to your arsenal');
    }
    closeModal('#habit-modal');
    refreshAllViews();
  }

  function refreshAllViews() {
    renderDashboard();
    if (state.view === 'history') renderHistory();
    if (state.view === 'stats') renderStats();
    if (state.view === 'profile') renderProfile();
    if (state.view === 'settings') renderArchivedList();
  }

  // Default "remove" action: archives the habit (reversible) rather than
  // deleting it outright, and offers an immediate Undo.
  function archiveCurrentHabit() {
    if (!state.editingHabitId) return;
    const id = state.editingHabitId;
    Store.archiveHabit(id);
    closeModal('#habit-modal');
    showToast('Habit archived', { label: 'Undo', onClick: () => { Store.restoreHabit(id); refreshAllViews(); } });
    refreshAllViews();
  }

  function permanentlyDeleteCurrentHabit() {
    if (!state.editingHabitId) return;
    if (!confirm('Permanently delete this habit and all of its history? This can\'t be undone.')) return;
    Store.permanentlyDeleteHabit(state.editingHabitId);
    closeModal('#habit-modal');
    showToast('Habit permanently deleted');
    refreshAllViews();
  }

  /* ---------- Archived habits (Settings) ---------- */
  function renderArchivedList() {
    const container = $('#archived-list');
    if (!container) return;
    const archived = Store.getHabits().filter(h => h.archived);
    container.innerHTML = '';
    if (archived.length === 0) {
      container.innerHTML = '<div class="archived-empty">No archived habits. Archiving a habit keeps its history but hides it from your active list.</div>';
      return;
    }
    archived.forEach(h => {
      const row = el('div', 'archived-row');
      row.innerHTML = `
        <div class="habit-icon" style="background:${hexAlpha(h.color, 0.16)}; color:${h.color}">${iconSVG(h.icon)}</div>
        <div class="archived-row-name">${escapeHTML(h.name)}</div>
        <button class="btn btn-sm" data-action="restore">Restore</button>
        <button class="icon-btn" data-action="delete" title="Delete permanently">${iconSVG('ic-ban')}</button>
      `;
      row.querySelector('[data-action="restore"]').addEventListener('click', () => {
        Store.restoreHabit(h.id);
        showToast('Habit restored');
        refreshAllViews();
      });
      row.querySelector('[data-action="delete"]').addEventListener('click', () => {
        if (!confirm(`Permanently delete "${h.name}" and all of its history? This can't be undone.`)) return;
        Store.permanentlyDeleteHabit(h.id);
        showToast('Habit permanently deleted');
        refreshAllViews();
      });
      container.appendChild(row);
    });
  }

  /* ---------- Modal helpers ---------- */
  function openModal(sel) { $(sel).classList.add('open'); }
  function closeModal(sel) { $(sel).classList.remove('open'); }

  function initModals() {
    $('#fab-add').addEventListener('click', () => { if (typeof Sound !== 'undefined') Sound.click(); openHabitModal(null); });
    $('#habit-modal-close').addEventListener('click', () => closeModal('#habit-modal'));
    $('#habit-modal').addEventListener('click', (e) => { if (e.target.id === 'habit-modal') closeModal('#habit-modal'); });
    $('#habit-form').addEventListener('submit', (e) => { if (typeof Sound !== 'undefined') Sound.click(); saveHabitForm(e); });
    $('#habit-delete-btn').addEventListener('click', archiveCurrentHabit);
    $('#habit-permadelete-btn').addEventListener('click', permanentlyDeleteCurrentHabit);
    $('#habit-frequency').addEventListener('change', (e) => {
      $('#days-field').style.display = e.target.value === 'weekdays' ? 'block' : 'none';
    });

    $('#day-modal-close').addEventListener('click', () => closeModal('#day-modal'));
    $('#day-modal').addEventListener('click', (e) => { if (e.target.id === 'day-modal') closeModal('#day-modal'); });

    $('#whatsnew-close').addEventListener('click', () => closeModal('#whatsnew-modal'));
    $('#whatsnew-ok').addEventListener('click', () => closeModal('#whatsnew-modal'));
    $('#whatsnew-modal').addEventListener('click', (e) => { if (e.target.id === 'whatsnew-modal') closeModal('#whatsnew-modal'); });
    $('#btn-whatsnew').addEventListener('click', () => openWhatsNew(true));
  }

  /* ---------- What's New ---------- */
  function openWhatsNew(showAll) {
    const body = $('#whatsnew-body');
    body.innerHTML = '';
    const entries = showAll ? self.CHANGELOG : [self.CHANGELOG[0]];
    entries.forEach((entry, idx) => {
      const wrap = el('div');
      if (idx > 0) wrap.style.marginTop = '20px';
      wrap.innerHTML = `<div class="whatsnew-version">VERSION ${entry.version} &middot; ${entry.date}</div>`;
      const ul = el('ul', 'whatsnew-list');
      entry.changes.forEach(c => {
        const li = el('li', '', escapeHTML(c));
        ul.appendChild(li);
      });
      wrap.appendChild(ul);
      body.appendChild(wrap);
    });
    openModal('#whatsnew-modal');
  }

  function checkForNewVersion() {
    const lastSeen = Store.getLastSeenVersion();
    if (lastSeen !== self.APP_VERSION) {
      Store.setLastSeenVersion(self.APP_VERSION);
      if (lastSeen !== null) {
        setTimeout(() => openWhatsNew(false), 700);
      }
    }
  }

  /* ---------- Settings ---------- */
  function initSettings() {
    $('#theme-btn-dark').addEventListener('click', () => setTheme('dark'));
    $('#theme-btn-light').addEventListener('click', () => setTheme('light'));

    const settings = Store.getSettings();
    $('#sound-btn-on').classList.toggle('active', settings.sound === true);
    $('#sound-btn-off').classList.toggle('active', settings.sound !== true);
    $('#sound-btn-on').addEventListener('click', () => {
      setSoundEnabled(true);
      $('#sound-btn-on').classList.add('active');
      $('#sound-btn-off').classList.remove('active');
      Sound.click();
    });
    $('#sound-btn-off').addEventListener('click', () => {
      Sound.click(); // plays just before disabling, so toggling off still gives feedback
      setSoundEnabled(false);
      $('#sound-btn-off').classList.add('active');
      $('#sound-btn-on').classList.remove('active');
    });

    $('#penalty-btn-on').classList.toggle('active', settings.penaltiesEnabled !== false);
    $('#penalty-btn-off').classList.toggle('active', settings.penaltiesEnabled === false);
    $('#penalty-btn-on').addEventListener('click', () => {
      const s = Store.getSettings(); s.penaltiesEnabled = true; Store.saveSettings(s);
      $('#penalty-btn-on').classList.add('active');
      $('#penalty-btn-off').classList.remove('active');
      if (typeof Sound !== 'undefined') Sound.click();
    });
    $('#penalty-btn-off').addEventListener('click', () => {
      const s = Store.getSettings(); s.penaltiesEnabled = false; Store.saveSettings(s);
      $('#penalty-btn-off').classList.add('active');
      $('#penalty-btn-on').classList.remove('active');
      if (typeof Sound !== 'undefined') Sound.click();
    });

    $('#btn-export').addEventListener('click', () => {
      const data = Store.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hunters-arsenal-backup-${Store.todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup exported');
    });

    $('#btn-import').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          Store.importData(data);
          showToast('Backup restored');
          renderDashboard();
        } catch (err) {
          alert(err.message || 'Could not read that file.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    $('#btn-reset').addEventListener('click', () => {
      if (!confirm('Erase all habits and history? This can\'t be undone.')) return;
      Store.wipeAll();
      showToast('All data cleared');
      renderDashboard();
    });
  }

  /* ---------- History week nav ---------- */
  function initHistoryNav() {
    $('#week-prev').addEventListener('click', () => { state.weekOffset--; renderHistory(); });
    $('#week-next').addEventListener('click', () => { if (state.weekOffset < 0) { state.weekOffset++; renderHistory(); } });
  }

  /* ---------- Onboarding ---------- */
  function initOnboarding() {
    const overlay = $('#onboarding');
    if (Store.isOnboarded()) { overlay.classList.add('hidden'); return; }

    const slides = $all('.ob-slide', overlay);
    const dots = $all('.ob-dot', overlay);
    let idx = 0;

    function show(i) {
      idx = i;
      slides.forEach((s, si) => s.classList.toggle('active', si === i));
      dots.forEach((d, di) => d.classList.toggle('active', di === i));
      $('#ob-next').style.display = i === slides.length - 1 ? 'none' : 'inline-flex';
      $('#ob-skip').style.display = i === slides.length - 1 ? 'none' : 'inline-flex';
    }

    function finish() {
      Store.setOnboarded();
      overlay.classList.add('hidden');
    }

    $('#ob-next').addEventListener('click', () => show(Math.min(idx + 1, slides.length - 1)));
    $('#ob-skip').addEventListener('click', finish);
    $('#ob-begin').addEventListener('click', finish);
    dots.forEach((d, i) => d.addEventListener('click', () => show(i)));

    show(0);
  }

  /* ---------- Yearly heatmap (History view) ---------- */
  function renderHeatmap() {
    const grid = $('#heatmap-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const habits = Store.getActiveHabits();
    const logs = Store.getLogs();
    const today = Store.todayISO();

    // Start on a Sunday so weeks align into clean 7-row columns.
    const rangeStart = addDays(today, -370);
    const start = startOfWeek(rangeStart);

    const weeks = [];
    let cursor = start;
    while (cursor <= today) {
      const week = [];
      for (let i = 0; i < 7; i++) { week.push(cursor); cursor = addDays(cursor, 1); }
      weeks.push(week);
    }

    let lastLabeledMonth = null;
    weeks.forEach(week => {
      const firstOfMonthDay = week.find(d => new Date(d + 'T00:00:00').getDate() <= 7);
      let label = '';
      if (firstOfMonthDay) {
        const monthIdx = new Date(firstOfMonthDay + 'T00:00:00').getMonth();
        if (monthIdx !== lastLabeledMonth) {
          label = new Date(firstOfMonthDay + 'T00:00:00').toLocaleDateString(undefined, { month: 'short' });
          lastLabeledMonth = monthIdx;
        }
      }
      const labelCell = el('div', 'heatmap-month-label', label);
      grid.appendChild(labelCell);

      week.forEach(dISO => {
        if (dISO > today) {
          grid.appendChild(el('div', 'heatmap-cell pad'));
          return;
        }
        const scheduled = habits.filter(h => Gamify.isScheduledForDate(h, dISO));
        let level = 0;
        if (scheduled.length > 0) {
          const done = scheduled.filter(h => Store.isDone(h.id, dISO)).length;
          const pct = done / scheduled.length;
          if (pct >= 1) level = 3;
          else if (pct >= 0.5) level = 2;
          else if (pct > 0) level = 1;
        }
        const cell = el('div', `heatmap-cell level-${level} clickable`);
        cell.title = `${formatDateLabel(dISO)} — ${scheduled.length ? Math.round((scheduled.filter(h => Store.isDone(h.id, dISO)).length / scheduled.length) * 100) + '%' : 'nothing scheduled'}`;
        cell.addEventListener('click', () => openDayModal(dISO));
        grid.appendChild(cell);
      });
    });

    // Scroll to the most recent weeks by default.
    const scrollWrap = $('#heatmap-scroll');
    if (scrollWrap) scrollWrap.scrollLeft = scrollWrap.scrollWidth;
  }

  /* ---------- Service worker ---------- */
  function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update();
        });
      }).catch(err => console.error('Service worker registration failed:', err));

      let refreshed = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshed) return;
        refreshed = true;
        window.location.reload();
      });
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    $('#sidebar-version').textContent = self.APP_VERSION;
    $('#settings-version').textContent = 'v' + self.APP_VERSION;

    initTheme();
    initSound();
    buildPickers();
    initNav();
    initModals();
    initSettings();
    initHistoryNav();
    initServiceWorker();
    initOnboarding();
    initDragReorder();

    checkDailyPenalty();
    renderDashboard();
    checkForNewVersion();
    checkAchievements();
    setTimeout(checkFreezeOffer, 1300);

    requestAnimationFrame(() => {
      setTimeout(() => {
        $('#loading-screen').classList.add('hidden');
        // Trigger the dashboard's entrance stagger only once it's actually visible.
        Effects.staggerChildren($('#dashboard-list'));
      }, 400);
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
