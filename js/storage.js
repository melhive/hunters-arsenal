/* Storage layer — everything lives in localStorage, on-device only. */

const KEYS = {
  habits: 'harsenal_habits',
  logs: 'harsenal_logs',                   // { 'YYYY-MM-DD': { habitId: xpValue } }
  settings: 'harsenal_settings',           // { theme, sound, penaltiesEnabled }
  lastSeenVersion: 'harsenal_last_seen_version',
  freezes: 'harsenal_freezes',             // number of streak-freeze tokens available
  frozenDates: 'harsenal_frozen_dates',    // [ 'YYYY-MM-DD', ... ] dates protected by a freeze
  perfectDays: 'harsenal_perfect_days',    // { 'YYYY-MM-DD': bonusXP }
  freezePrompted: 'harsenal_freeze_prompted', // [ 'YYYY-MM-DD', ... ] dates already asked about
  achievements: 'harsenal_achievements',   // [ achievementId, ... ] unlocked
  equippedTitle: 'harsenal_equipped_title', // achievementId or null
  onboarded: 'harsenal_onboarded',         // 'true' once the intro has been shown
  lastGreetingDate: 'harsenal_last_greeting_date', // 'YYYY-MM-DD' the daily greeting was last shown
  name: 'harsenal_name',                   // hunter's display name, optional
  photo: 'harsenal_photo',                 // data URL, resized client-side, optional
  penalties: 'harsenal_penalties',         // { 'YYYY-MM-DD': xpLost }
  penaltyProcessed: 'harsenal_penalty_processed' // [ 'YYYY-MM-DD', ... ] dates already checked
};

const DEFAULT_HABITS = [
  { id: 'h_water', name: 'Drink water', icon: 'ic-droplet', color: '#5eb1e8', stat: 'VIT', archived: false, frequency: { type: 'daily' }, createdAt: todayISO() },
  { id: 'h_read', name: 'Read 20 minutes', icon: 'ic-book', color: '#e8a33d', stat: 'INT', archived: false, frequency: { type: 'daily' }, createdAt: todayISO() },
  { id: 'h_train', name: 'Train', icon: 'ic-dumbbell', color: '#7cd45e', stat: 'STR', archived: false, frequency: { type: 'weekdays', days: [1, 2, 3, 4, 5] }, createdAt: todayISO() }
];

function todayISO(d = new Date()) {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('Storage read failed for', key, e);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('Storage write failed for', key, e);
    return false;
  }
}

const Store = {
  todayISO,

  getHabits() {
    let habits = readJSON(KEYS.habits, null);
    if (habits === null) {
      habits = DEFAULT_HABITS;
      writeJSON(KEYS.habits, habits);
    }
    // Backfill fields for habits saved before stats/archiving existed.
    let changed = false;
    habits.forEach(h => {
      if (!h.stat) { h.stat = 'STR'; changed = true; }
      if (typeof h.archived !== 'boolean') { h.archived = false; changed = true; }
    });
    if (changed) writeJSON(KEYS.habits, habits);
    return habits;
  },

  // Habits currently in rotation — excludes archived ones. Use this for anything
  // the user interacts with today (dashboard, history rows, mastery lists).
  // Use getHabits() (full list) for historical XP/stat lookups so archiving a
  // habit never erases XP it already earned.
  getActiveHabits() {
    return this.getHabits().filter(h => !h.archived);
  },

  saveHabits(habits) {
    return writeJSON(KEYS.habits, habits);
  },

  addHabit(habit) {
    const habits = this.getHabits();
    habit.id = 'h_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    habit.createdAt = todayISO();
    habit.archived = false;
    habits.push(habit);
    this.saveHabits(habits);
    return habit;
  },

  updateHabit(id, updates) {
    const habits = this.getHabits().map(h => h.id === id ? { ...h, ...updates } : h);
    this.saveHabits(habits);
  },

  archiveHabit(id) {
    this.updateHabit(id, { archived: true });
  },

  restoreHabit(id) {
    this.updateHabit(id, { archived: false });
  },

  // Reorders active habits to match orderedIds (an array of habit ids in the
  // desired display order). Archived habits are left in place at the end —
  // their order never matters since they're only shown in a flat list.
  reorderHabits(orderedIds) {
    const all = this.getHabits();
    const byId = {};
    all.forEach(h => { byId[h.id] = h; });

    const reorderedActive = orderedIds.map(id => byId[id]).filter(Boolean);
    const placedIds = new Set(orderedIds);
    const strayActive = all.filter(h => !h.archived && !placedIds.has(h.id));
    const archived = all.filter(h => h.archived);

    this.saveHabits([...reorderedActive, ...strayActive, ...archived]);
  },

  // Permanently removes a habit AND its logged history. Irreversible —
  // archiveHabit() is the safe, reversible alternative used by the UI's
  // default "Archive" action.
  permanentlyDeleteHabit(id) {
    const habits = this.getHabits().filter(h => h.id !== id);
    this.saveHabits(habits);
    const logs = this.getLogs();
    Object.keys(logs).forEach(date => { delete logs[date][id]; });
    this.saveLogs(logs);
  },

  getLogs() {
    return readJSON(KEYS.logs, {});
  },

  saveLogs(logs) {
    return writeJSON(KEYS.logs, logs);
  },

  isDone(habitId, dateISO) {
    const logs = this.getLogs();
    return !!(logs[dateISO] && logs[dateISO][habitId]);
  },

  // xpValue is snapshotted at the moment of completion (computed by the
  // caller from the CURRENT hunter rank) so future rank changes never
  // retroactively rewrite XP already earned. Ignored when un-toggling.
  toggle(habitId, dateISO, xpValue) {
    const logs = this.getLogs();
    if (!logs[dateISO]) logs[dateISO] = {};
    if (logs[dateISO][habitId]) {
      delete logs[dateISO][habitId];
    } else {
      logs[dateISO][habitId] = xpValue && xpValue > 0 ? xpValue : 10;
    }
    this.saveLogs(logs);
    return !!logs[dateISO][habitId];
  },

  getSettings() {
    return readJSON(KEYS.settings, { theme: null, sound: false, penaltiesEnabled: true });
  },

  saveSettings(settings) {
    return writeJSON(KEYS.settings, settings);
  },

  getLastSeenVersion() {
    return localStorage.getItem(KEYS.lastSeenVersion);
  },

  setLastSeenVersion(v) {
    localStorage.setItem(KEYS.lastSeenVersion, v);
  },

  /* ---- Onboarding ---- */
  isOnboarded() {
    return localStorage.getItem(KEYS.onboarded) === 'true';
  },
  setOnboarded() {
    localStorage.setItem(KEYS.onboarded, 'true');
  },

  /* ---- Daily greeting ---- */
  getLastGreetingDate() {
    return localStorage.getItem(KEYS.lastGreetingDate);
  },
  setLastGreetingDate(dateISO) {
    localStorage.setItem(KEYS.lastGreetingDate, dateISO);
  },

  /* ---- Hunter identity (name/photo) — optional, local-only ---- */
  getName() {
    return localStorage.getItem(KEYS.name) || '';
  },
  setName(name) {
    const trimmed = (name || '').trim().slice(0, 30);
    if (trimmed) localStorage.setItem(KEYS.name, trimmed);
    else localStorage.removeItem(KEYS.name);
  },
  getPhoto() {
    return localStorage.getItem(KEYS.photo) || null;
  },
  setPhoto(dataURL) {
    localStorage.setItem(KEYS.photo, dataURL);
  },
  clearPhoto() {
    localStorage.removeItem(KEYS.photo);
  },

  /* ---- Streak freezes ---- */
  getFreezeCount() {
    return readJSON(KEYS.freezes, 0);
  },
  setFreezeCount(n) {
    writeJSON(KEYS.freezes, Math.max(0, n));
  },
  getFrozenDates() {
    return readJSON(KEYS.frozenDates, []);
  },
  addFrozenDate(dateISO) {
    const dates = this.getFrozenDates();
    if (!dates.includes(dateISO)) dates.push(dateISO);
    writeJSON(KEYS.frozenDates, dates);
  },
  getFreezePrompted() {
    return readJSON(KEYS.freezePrompted, []);
  },
  markFreezePrompted(dateISO) {
    const dates = this.getFreezePrompted();
    if (!dates.includes(dateISO)) dates.push(dateISO);
    writeJSON(KEYS.freezePrompted, dates);
  },

  /* ---- Perfect days ---- */
  getPerfectDays() {
    return readJSON(KEYS.perfectDays, {});
  },
  setPerfectDay(dateISO, bonusXP) {
    const days = this.getPerfectDays();
    days[dateISO] = bonusXP;
    writeJSON(KEYS.perfectDays, days);
  },
  clearPerfectDay(dateISO) {
    const days = this.getPerfectDays();
    delete days[dateISO];
    writeJSON(KEYS.perfectDays, days);
  },

  /* ---- Penalties (missed daily quests) ---- */
  getPenalties() {
    return readJSON(KEYS.penalties, {});
  },
  setPenalty(dateISO, amount) {
    const p = this.getPenalties();
    p[dateISO] = amount;
    writeJSON(KEYS.penalties, p);
  },
  getPenaltyProcessed() {
    return readJSON(KEYS.penaltyProcessed, []);
  },
  markPenaltyProcessed(dateISO) {
    const dates = this.getPenaltyProcessed();
    if (!dates.includes(dateISO)) dates.push(dateISO);
    writeJSON(KEYS.penaltyProcessed, dates);
  },

  /* ---- Achievements / titles ---- */
  getAchievements() {
    return readJSON(KEYS.achievements, []);
  },
  unlockAchievement(id) {
    const list = this.getAchievements();
    if (!list.includes(id)) { list.push(id); writeJSON(KEYS.achievements, list); return true; }
    return false;
  },
  getEquippedTitle() {
    return localStorage.getItem(KEYS.equippedTitle) || null;
  },
  setEquippedTitle(id) {
    if (id) localStorage.setItem(KEYS.equippedTitle, id);
    else localStorage.removeItem(KEYS.equippedTitle);
  },

  /* ---- Backup / restore ---- */
  exportData() {
    return {
      exportedAt: new Date().toISOString(),
      version: self.APP_VERSION,
      habits: this.getHabits(),
      logs: this.getLogs(),
      settings: this.getSettings(),
      freezes: this.getFreezeCount(),
      frozenDates: this.getFrozenDates(),
      perfectDays: this.getPerfectDays(),
      achievements: this.getAchievements(),
      equippedTitle: this.getEquippedTitle(),
      penalties: this.getPenalties(),
      name: this.getName(),
      photo: this.getPhoto()
    };
  },

  importData(data) {
    if (!data || !Array.isArray(data.habits) || typeof data.logs !== 'object') {
      throw new Error('That file doesn\u2019t look like a Hunter\u2019s Arsenal backup.');
    }
    this.saveHabits(data.habits);
    this.saveLogs(data.logs);
    if (data.settings) this.saveSettings(data.settings);
    if (typeof data.freezes === 'number') this.setFreezeCount(data.freezes);
    if (Array.isArray(data.frozenDates)) writeJSON(KEYS.frozenDates, data.frozenDates);
    if (data.perfectDays) writeJSON(KEYS.perfectDays, data.perfectDays);
    if (Array.isArray(data.achievements)) writeJSON(KEYS.achievements, data.achievements);
    if (data.equippedTitle) this.setEquippedTitle(data.equippedTitle);
    if (data.penalties) writeJSON(KEYS.penalties, data.penalties);
    if (typeof data.name === 'string') this.setName(data.name);
    if (typeof data.photo === 'string') this.setPhoto(data.photo);
  },

  wipeAll() {
    Object.values(KEYS).forEach(k => {
      // Keep theme/sound/penalty settings, version marker, onboarding state,
      // and hunter identity (name/photo) — a habit data reset shouldn't erase who you are.
      if (k === KEYS.settings || k === KEYS.lastSeenVersion || k === KEYS.onboarded || k === KEYS.name || k === KEYS.photo) return;
      localStorage.removeItem(k);
    });
  }
};
