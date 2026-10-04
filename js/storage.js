/* Storage layer — everything lives in localStorage, on-device only. */

const KEYS = {
  habits: 'harsenal_habits',
  logs: 'harsenal_logs',                   // { 'YYYY-MM-DD': { habitId: xpValue } }
  settings: 'harsenal_settings',           // { theme, sound, penaltiesEnabled }
  lastSeenVersion: 'harsenal_last_seen_version',
  freezes: 'harsenal_freezes',             // number of streak-freeze tokens available
  frozenDates: 'harsenal_frozen_dates',    // [ 'YYYY-MM-DD', ... ] dates protected by a freeze
  perfectDays: 'harsenal_perfect_days',    // { 'YYYY-MM-DD': bonusXP }
  questBonuses: 'harsenal_quest_bonuses',  // { 'YYYY-MM-DD': Hunter XP }
  freezePrompted: 'harsenal_freeze_prompted', // [ 'YYYY-MM-DD', ... ] dates already asked about
  achievements: 'harsenal_achievements',   // [ achievementId, ... ] unlocked
  equippedTitle: 'harsenal_equipped_title', // achievementId or null
  onboarded: 'harsenal_onboarded',         // 'true' once the intro has been shown
  lastGreetingDate: 'harsenal_last_greeting_date', // 'YYYY-MM-DD' the daily greeting was last shown
  name: 'harsenal_name',                   // hunter's display name, optional
  photo: 'harsenal_photo',                 // data URL, resized/cropped client-side, optional
  birthdate: 'harsenal_birthdate',         // ISO date 'YYYY-MM-DD', optional
  lifespanYears: 'harsenal_lifespan_years', // estimated lifespan in years, optional
  dailyQuestChoices: 'harsenal_daily_quest_choices', // { 'YYYY-MM-DD': 'accepted'|'declined' }
  dailyQuestCycle: 'harsenal_daily_quest_cycle', // current scheduled/active quest cycle
  penalties: 'harsenal_penalties',         // { 'YYYY-MM-DD': xpLost }
  penaltyProcessed: 'harsenal_penalty_processed' // [ 'YYYY-MM-DD', ... ] dates already checked
};

const DEFAULT_HABITS = [
  { id: 'h_pushups', name: '50 Push-ups', icon: 'ic-dumbbell', color: '#d95c67', stat: 'STR', archived: false, frequency: { type: 'daily' }, createdAt: todayISO() },
  { id: 'h_situps', name: '50 Sit-ups', icon: 'ic-dumbbell', color: '#d95c67', stat: 'STR', archived: false, frequency: { type: 'daily' }, createdAt: todayISO() },
  { id: 'h_run', name: '2 km Run', icon: 'ic-run', color: '#58b982', stat: 'VIT', archived: false, frequency: { type: 'daily' }, createdAt: todayISO() }
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
    if (habits.filter(h => !h.archived).length >= Gamify.MAX_HABITS) return null;
    habit.id = 'h_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    habit.createdAt = todayISO();
    habit.archived = false;
    habits.push(habit);
    this.saveHabits(habits);
    return habit;
  },

  updateHabit(id, updates) {
    const existing = this.getHabits().find(h => h.id === id);
    if (existing && updates.stat && updates.stat !== existing.stat) this.freezeLegacyProgression(id, existing.stat);
    const habits = this.getHabits().map(h => h.id === id ? { ...h, ...updates } : h);
    this.saveHabits(habits);
  },

  archiveHabit(id) {
    this.updateHabit(id, { archived: true });
  },

  restoreHabit(id) {
    const habits = this.getHabits();
    const habit = habits.find(h => h.id === id);
    if (!habit) return false;
    if (!habit.archived) return true;
    if (habits.filter(h => !h.archived).length >= Gamify.MAX_HABITS) return false;
    this.updateHabit(id, { archived: false });
    return true;
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

  // Permanently removes the habit definition but keeps reward records so
  // previously earned Hunter, attribute, and mastery XP remain intact.
  permanentlyDeleteHabit(id) {
    const habits = this.getHabits().filter(h => h.id !== id);
    const deleted = this.getHabits().find(h => h.id === id);
    if (deleted) this.freezeLegacyProgression(id, deleted.stat || Gamify.DEFAULT_STAT);
    this.saveHabits(habits);
  },

  // Materialize legacy entries before a stat change or deletion so their
  // attribute and mastery history remains attached to the persistent habit ID.
  freezeLegacyProgression(habitId, assignedStat) {
    const logs = this.getLogs();
    let changed = false;
    Object.keys(logs).forEach(date => {
      if (!Object.prototype.hasOwnProperty.call(logs[date], habitId)) return;
      const entry = logs[date][habitId];
      if (entry && typeof entry === 'object') return;
      logs[date][habitId] = Gamify.progressionRecordFromLegacy(entry, assignedStat);
      changed = true;
    });
    if (changed) this.saveLogs(logs);
  },

  getLogs() {
    return readJSON(KEYS.logs, {});
  },

  saveLogs(logs) {
    return writeJSON(KEYS.logs, logs);
  },

  isDone(habitId, dateISO) {
    const logs = this.getLogs();
    return Gamify.isCompletedEntry(logs[dateISO] && logs[dateISO][habitId]);
  },

  // The one habit reward transaction: completion state and all three earned
  // progression rewards share one date + persistent habit ID record.
  toggleHabit(habitId, dateISO) {
    if (dateISO !== this.todayISO()) {
      return { done: this.isDone(habitId, dateISO), awarded: false, ignored: true };
    }
    const habit = this.getHabits().find(h => h.id === habitId);
    if (!habit || habit.archived) return { done: false, awarded: false, ignored: true };
    const logs = this.getLogs();
    if (!logs[dateISO]) logs[dateISO] = {};
    const day = logs[dateISO];
    const hasEntry = Object.prototype.hasOwnProperty.call(day, habitId);
    const current = hasEntry
      ? Gamify.progressionRecordFromLegacy(day[habitId], habit.stat || Gamify.DEFAULT_STAT)
      : { completed: false, rewarded: false, hunterXP: 0, attributeXP: 0, attribute: habit.stat || Gamify.DEFAULT_STAT, masteryXP: 0 };
    let awarded = false;
    if (current.completed) {
      current.completed = false;
      current.rewarded = false;
      current.hunterXP = 0;
      current.attributeXP = 0;
      current.masteryXP = 0;
      delete current.awarded;
      delete current.capped;
    } else {
      current.completed = true;
      const xpAwardedCompletions = Object.entries(day)
        .filter(([id, value]) => id !== habitId && Gamify.xpValueOf(value) > 0).length;
      current.rewarded = true;
      if (xpAwardedCompletions < Gamify.MAX_HABITS) {
        current.hunterXP = Gamify.BASE_XP;
        current.attributeXP = Gamify.PROGRESSION.attributeXPPerHabit;
        current.attribute = habit.stat || Gamify.DEFAULT_STAT;
        current.masteryXP = Gamify.PROGRESSION.masteryXPPerHabit;
        current.awarded = new Date().toISOString();
        delete current.capped;
        awarded = true;
      } else {
        current.hunterXP = 0;
        current.attributeXP = 0;
        current.masteryXP = 0;
        current.capped = true;
      }
    }
    day[habitId] = current;
    this.saveLogs(logs);
    return { done: current.completed, awarded, record: current, habit };
  },

  // Compatibility wrapper for any older in-app caller.
  toggle(habitId, dateISO) {
    const result = this.toggleHabit(habitId, dateISO);
    return result.ignored ? false : result.done;
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

  /* ---- Life Clock ---- */
  getBirthdate() {
    return localStorage.getItem(KEYS.birthdate) || null;
  },
  setBirthdate(dateISO) {
    if (dateISO) localStorage.setItem(KEYS.birthdate, dateISO);
    else localStorage.removeItem(KEYS.birthdate);
  },
  getLifespanYears() {
    const v = localStorage.getItem(KEYS.lifespanYears);
    return v ? Number(v) : null;
  },
  setLifespanYears(years) {
    const n = Number(years);
    if (years && !isNaN(n) && n > 0) localStorage.setItem(KEYS.lifespanYears, String(n));
    else localStorage.removeItem(KEYS.lifespanYears);
  },
  hasLifeClockSetup() {
    return !!(this.getBirthdate() && this.getLifespanYears());
  },

  /* ---- Daily Quest ---- */
  getDailyQuestChoice(dateISO) {
    const map = readJSON(KEYS.dailyQuestChoices, {});
    return map[dateISO] || null;
  },
  setDailyQuestChoice(dateISO, choice) {
    const map = readJSON(KEYS.dailyQuestChoices, {});
    map[dateISO] = choice;
    writeJSON(KEYS.dailyQuestChoices, map);
  },
  getDailyQuestCycle() {
    const cycle = readJSON(KEYS.dailyQuestCycle, null);
    const choice = cycle && this.getDailyQuestChoice(cycle.date);
    // A cycle cannot fail before acceptance. Repair only that invalid legacy state.
    if (cycle && cycle.status === 'failed' && choice !== 'accepted') {
      const declined = choice === 'declined';
      cycle.status = declined ? 'available' : 'scheduled';
      cycle.presented = declined;
      delete cycle.finishedAt;
      writeJSON(KEYS.dailyQuestCycle, cycle);
    }
    return cycle;
  },
  setDailyQuestCycle(cycle) {
    if (cycle) writeJSON(KEYS.dailyQuestCycle, cycle);
    else localStorage.removeItem(KEYS.dailyQuestCycle);
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
  getQuestBonuses() {
    return readJSON(KEYS.questBonuses, {});
  },
  awardQuestBonus(dateISO) {
    if (dateISO !== this.todayISO()) return false;
    const bonuses = this.getQuestBonuses();
    if (bonuses[dateISO]) return false;
    bonuses[dateISO] = Gamify.PROGRESSION.dailyQuestXP;
    return writeJSON(KEYS.questBonuses, bonuses);
  },
  removeQuestBonus(dateISO) {
    if (dateISO !== this.todayISO()) return false;
    const bonuses = this.getQuestBonuses();
    if (!Object.prototype.hasOwnProperty.call(bonuses, dateISO)) return false;
    delete bonuses[dateISO];
    return writeJSON(KEYS.questBonuses, bonuses);
  },
  setPerfectDay(dateISO, bonusXP) {
    if (dateISO !== this.todayISO()) return false;
    const days = this.getPerfectDays();
    days[dateISO] = bonusXP;
    return writeJSON(KEYS.perfectDays, days);
  },
  clearPerfectDay(dateISO) {
    if (dateISO !== this.todayISO()) return false;
    const days = this.getPerfectDays();
    const entry = days[dateISO];
    const accepted = this.getDailyQuestChoice(dateISO) === 'accepted';
    const hasSeparateQuestBonus = Object.prototype.hasOwnProperty.call(this.getQuestBonuses(), dateISO);
    // Older builds folded the accepted quest's +25 into a numeric perfect-day
    // bonus. Split it before the caller reverses the quest completion.
    if (typeof entry === 'number' && accepted && !hasSeparateQuestBonus) {
      const remainder = Math.max(0, entry - Gamify.PROGRESSION.dailyQuestXP);
      if (remainder > 0) days[dateISO] = remainder;
      else delete days[dateISO];
      this.awardQuestBonus(dateISO);
    } else if (!(typeof entry === 'number' && accepted && hasSeparateQuestBonus)) {
      delete days[dateISO];
    }
    return writeJSON(KEYS.perfectDays, days);
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
      questBonuses: this.getQuestBonuses(),
      achievements: this.getAchievements(),
      equippedTitle: this.getEquippedTitle(),
      penalties: this.getPenalties(),
      name: this.getName(),
      photo: this.getPhoto(),
      birthdate: this.getBirthdate(),
      lifespanYears: this.getLifespanYears()
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
    if (data.questBonuses) writeJSON(KEYS.questBonuses, data.questBonuses);
    if (Array.isArray(data.achievements)) writeJSON(KEYS.achievements, data.achievements);
    if (data.equippedTitle) this.setEquippedTitle(data.equippedTitle);
    if (data.penalties) writeJSON(KEYS.penalties, data.penalties);
    if (typeof data.name === 'string') this.setName(data.name);
    if (typeof data.photo === 'string') this.setPhoto(data.photo);
    if (typeof data.birthdate === 'string') this.setBirthdate(data.birthdate);
    if (typeof data.lifespanYears === 'number') this.setLifespanYears(data.lifespanYears);
  },

  wipeAll() {
    Object.values(KEYS).forEach(k => {
      // Keep theme/sound/penalty settings, version marker, onboarding state,
      // hunter identity (name/photo), and Life Clock setup — a habit data
      // reset shouldn't erase who you are.
      if (k === KEYS.settings || k === KEYS.lastSeenVersion || k === KEYS.onboarded
          || k === KEYS.name || k === KEYS.photo || k === KEYS.birthdate || k === KEYS.lifespanYears) return;
      localStorage.removeItem(k);
    });
  }
};
