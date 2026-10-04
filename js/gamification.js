/* Ranks, XP, stats, streaks, perfect-day, and penalty math. Pure functions — no DOM, no storage writes. */

// Authoritative progression and reward values. Rank XP anchors are derived
// from these level requirements so the two mappings cannot drift apart.
const PROGRESSION = {
  habitXP: 10,
  dailyQuestXP: 25,
  maxActiveHabits: 8,
  attributeXPPerHabit: 5,
  masteryXPPerHabit: 5,
  ranks: [
    { id: 'E', label: 'E-Rank', minLevel: 1, maxLevel: 12, color: '#8B9AA3', requirements: [80,88,96,105,113,121,129,137,145,154,162,170] },
    { id: 'D', label: 'D-Rank', minLevel: 13, maxLevel: 29, color: '#6F9DB5', requirements: [190,199,208,217,227,236,245,256,265,274,284,293,302,312,321,331,340] },
    { id: 'C', label: 'C-Rank', minLevel: 30, maxLevel: 49, color: '#4FBBC5', requirements: [350,355,361,366,371,376,382,387,392,397,403,408,413,418,424,429,434,439,445,450] },
    { id: 'B', label: 'B-Rank', minLevel: 50, maxLevel: 69, color: '#6878C8', requirements: [500,505,511,516,521,526,532,537,542,547,553,558,563,568,574,579,584,589,595,600] },
    { id: 'A', label: 'A-Rank', minLevel: 70, maxLevel: 89, color: '#9A72D8', requirements: [620,623,626,629,633,636,639,642,645,648,652,655,658,661,664,667,671,674,677,680] },
    { id: 'S', label: 'S-Rank', minLevel: 90, maxLevel: 100, color: '#D6A84F', requirements: [850,883,917,950,983,1017,1050,1083,1117,1150] }
  ],
  attributes: {
    thresholds: [100,300,700,1200,1800],
    classes: {
      STR: ['Brawler','Berserker','Warbringer','Juggernaut','Titan'],
      VIT: ['Survivor','Endurer','Bastion','Aegis','Colossus'],
      INT: ['Thinker','Analyst','Strategist','Sage','Archon'],
      PER: ['Observer','Tracker','Pathfinder','Seer','Oracle'],
      CHA: ['Speaker','Charmer','Luminary','Commander','Sovereign']
    }
  },
  mastery: [
    { name: 'Awakened', min: 0, icon: 'ic-smile' },
    { name: 'Forged', min: 50, icon: 'ic-target' },
    { name: 'Hunter', min: 150, icon: 'ic-star' },
    { name: 'Veteran', min: 400, icon: 'ic-shield' },
    { name: 'Apex', min: 1000, icon: 'ic-flame' },
    { name: 'Ascendant', min: 2500, icon: 'ic-trophy' }
  ]
};
const RANKS = PROGRESSION.mastery;
const HUNTER_RANKS = (() => {
  let minXP = 0;
  return PROGRESSION.ranks.map(rank => {
    const result = { ...rank, minXP };
    minXP += rank.requirements.reduce((sum, xp) => sum + xp, 0);
    return result;
  });
})();
const LEVEL_XP_REQUIREMENTS = PROGRESSION.ranks.flatMap(rank => rank.requirements);
const BASE_XP = PROGRESSION.habitXP;
const MAX_LEVEL = 100;
const MAX_HABITS = PROGRESSION.maxActiveHabits;
const MAX_DAILY_HABIT_XP = MAX_HABITS * BASE_XP;

function rankForLevel(level) {
  level = Math.min(MAX_LEVEL, Math.max(1, level));
  let current = HUNTER_RANKS[0];
  for (const r of HUNTER_RANKS) {
    if (level >= r.minLevel && level <= r.maxLevel) return r;
  }
  return current;
}

function rankForXP(xp) {
  return rankForLevel(levelFromXP(xp).level);
}

// Each habit completion always grants the locked base amount.
function xpForCompletion() {
  return BASE_XP;
}

// A log entry may be a plain `true` (habits completed before this XP system
// existed) or a snapshotted XP number. This normalizes either to a number.
function xpValueOf(entry) {
  if (entry && typeof entry === 'object') return Math.max(0, Number(entry.hunterXP) || 0);
  if (entry === true) return BASE_XP; // legacy completions, treated as base-rate
  if (typeof entry === 'number' && entry > 0) return entry;
  return 0;
}

function isCompletedEntry(entry) {
  return entry && typeof entry === 'object' ? entry.completed === true : !!entry;
}

function attributeXPOf(entry) {
  if (entry && typeof entry === 'object') return Math.max(0, Number(entry.attributeXP) || 0);
  return entry && entry !== -1 ? PROGRESSION.attributeXPPerHabit : 0;
}

function attributeOf(entry, fallbackStat) {
  return entry && typeof entry === 'object' && entry.attribute ? entry.attribute : (fallbackStat || DEFAULT_STAT);
}

function masteryXPOf(entry) {
  if (entry && typeof entry === 'object') return Math.max(0, Number(entry.masteryXP) || 0);
  return entry ? PROGRESSION.masteryXPPerHabit : 0;
}

function progressionRecordFromLegacy(entry, assignedStat) {
  if (entry && typeof entry === 'object') return { ...entry };
  if (entry === -1) {
    return { completed: true, rewarded: true, hunterXP: 0, attributeXP: 0, attribute: assignedStat || DEFAULT_STAT, masteryXP: PROGRESSION.masteryXPPerHabit, capped: true };
  }
  if (entry === false) {
    return { completed: false, rewarded: true, hunterXP: 0, attributeXP: 0, attribute: assignedStat || DEFAULT_STAT, masteryXP: 0 };
  }
  if (entry) {
    const xp = xpValueOf(entry);
    return { completed: true, rewarded: true, hunterXP: xp, attributeXP: PROGRESSION.attributeXPPerHabit, attribute: assignedStat || DEFAULT_STAT, masteryXP: PROGRESSION.masteryXPPerHabit };
  }
  return { completed: false, rewarded: false, hunterXP: 0, attributeXP: 0, attribute: assignedStat || DEFAULT_STAT, masteryXP: 0 };
}

// The five hunter stats. Every habit feeds exactly one.
const STATS = [
  { id: 'STR', label: 'Strength', icon: 'ic-stat-str' },
  { id: 'VIT', label: 'Vitality', icon: 'ic-stat-vit' },
  { id: 'INT', label: 'Intellect', icon: 'ic-stat-int' },
  { id: 'PER', label: 'Perception', icon: 'ic-stat-per' },
  { id: 'CHA', label: 'Charisma', icon: 'ic-stat-cha' }
];
const DEFAULT_STAT = 'STR';

// Flavor-only "Class" tag: whichever stat you've invested the most XP in
// determines your current archetype tier. This is purely descriptive (not
// an unlockable achievement) — it just reflects your current build, and can
// change if your focus shifts. Tiers scale with that ONE stat's own XP,
// independent of overall Hunter Rank.
const CLASS_TIERS = PROGRESSION.attributes.classes;
const CLASS_TIER_THRESHOLDS = PROGRESSION.attributes.thresholds;

// Given attribute XP totals, returns the current dominant attribute class.
function classForAttribute(stat, xp) {
  const tiers = CLASS_TIERS[stat];
  if (!tiers || xp < CLASS_TIER_THRESHOLDS[0]) return null;
  let tierIndex = 0;
  for (let i = 0; i < CLASS_TIER_THRESHOLDS.length; i++) {
    if (xp >= CLASS_TIER_THRESHOLDS[i]) tierIndex = i;
  }
  const nextThreshold = CLASS_TIER_THRESHOLDS[tierIndex + 1] || null;
  return {
    stat,
    name: tiers[tierIndex],
    tier: tierIndex + 1,
    xp,
    nextThreshold,
    progress: nextThreshold ? (xp - CLASS_TIER_THRESHOLDS[tierIndex]) / (nextThreshold - CLASS_TIER_THRESHOLDS[tierIndex]) : 1
  };
}

function currentClass(statTotals, preferredStat) {
  const bestXP = Math.max(0, ...STATS.map(s => statTotals[s.id] || 0));
  if (bestXP < CLASS_TIER_THRESHOLDS[0]) return null;
  const tiedStats = STATS.filter(s => (statTotals[s.id] || 0) === bestXP);
  const bestStat = tiedStats.some(s => s.id === preferredStat) ? preferredStat : tiedStats[0].id;
  return classForAttribute(bestStat, bestXP);
}

function rankFor(masteryXP) {
  masteryXP = Math.max(0, masteryXP || 0);
  let current = RANKS[0];
  for (const r of RANKS) {
    if (masteryXP >= r.min) current = r;
  }
  const idx = RANKS.indexOf(current);
  const next = RANKS[idx + 1] || null;
  const progress = next ? (masteryXP - current.min) / (next.min - current.min) : 1;
  return { ...current, next, progress: Math.min(1, Math.max(0, progress)), xp: masteryXP };
}

function isScheduledForDate(habit, dateISO) {
  const freq = habit.frequency || { type: 'daily' };
  if (freq.type === 'daily') return true;
  const day = new Date(dateISO + 'T00:00:00').getDay();
  if (freq.type === 'weekdays') return (freq.days || []).includes(day);
  if (freq.type === 'timesPerWeek') return true; // any day counts toward the weekly goal
  return true;
}

function countCompletions(habitId, logs) {
  let count = 0;
  for (const date in logs) {
    if (isCompletedEntry(logs[date][habitId])) count++;
  }
  return count;
}

function masteryXPForHabit(habitId, logs) {
  let total = 0;
  for (const date in logs) total += masteryXPOf(logs[date][habitId]);
  return total;
}

function localISO(d) {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

// Life Clock — purely a live calculation from birthdate + estimated lifespan,
// never stored/cached, so it always reflects the current moment with no
// manual "deduct a day" bookkeeping needed anywhere.
const DAYS_PER_YEAR = 365.25; // accounts for leap years on average
function lifeClockStats(birthdateISO, lifespanYears, nowDate) {
  const now = nowDate || new Date();
  const birth = new Date(birthdateISO + 'T00:00:00');
  const msPerDay = 86400000;
  const daysLived = Math.floor((now - birth) / msPerDay);
  const totalDays = Math.round(lifespanYears * DAYS_PER_YEAR);
  const daysRemaining = Math.max(0, totalDays - daysLived);
  const ageYears = daysLived / DAYS_PER_YEAR;
  return { daysLived, totalDays, daysRemaining, ageYears };
}

function currentStreak(habit, logs, todayISO) {
  let streak = 0;
  let cursor = new Date(todayISO + 'T00:00:00');
  // If today isn't done yet but is scheduled, start checking from yesterday
  // so an unfinished "today" doesn't zero out an active streak mid-day.
  const todayDone = isCompletedEntry(logs[todayISO] && logs[todayISO][habit.id]);
  if (!todayDone) cursor.setDate(cursor.getDate() - 1);

  for (let i = 0; i < 3650; i++) {
    const dISO = localISO(cursor);
    if (isScheduledForDate(habit, dISO)) {
      const done = isCompletedEntry(logs[dISO] && logs[dISO][habit.id]);
      if (done) {
        streak++;
      } else {
        break;
      }
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Longest streak ever achieved for this habit, scanning its full history.
// Used for achievements so a badge earned once isn't lost when a streak later breaks.
function longestStreak(habit, logs) {
  const dates = Object.keys(logs).sort();
  if (dates.length === 0) return 0;
  const first = dates[0];
  const last = localISO(new Date());
  let best = 0, running = 0;
  let cursor = new Date(first + 'T00:00:00');
  const end = new Date(last + 'T00:00:00');
  for (let i = 0; i < 3650 && cursor <= end; i++) {
    const dISO = localISO(cursor);
    if (isScheduledForDate(habit, dISO)) {
      const done = isCompletedEntry(logs[dISO] && logs[dISO][habit.id]);
      if (done) { running++; best = Math.max(best, running); }
      else { running = 0; }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return best;
}

function habitById(habits, id) {
  return habits.find(h => h.id === id) || null;
}

// Total XP = stored habit XP + perfect-day bonuses - penalties, floored at 0.
function totalXP(logs, perfectDays, penalties, questBonuses) {
  let total = 0;
  for (const date in logs) {
    for (const habitId in logs[date]) {
      total += xpValueOf(logs[date][habitId]);
    }
  }
  if (perfectDays) {
    // Numeric entries are historical XP bonuses. New perfect-day markers are
    // booleans and only track the streak/achievement state.
    for (const date in perfectDays) {
      if (typeof perfectDays[date] === 'number') total += perfectDays[date];
    }
  }
  if (questBonuses) {
    for (const date in questBonuses) total += questBonuses[date] || 0;
  }
  if (penalties) {
    for (const date in penalties) total -= penalties[date] || 0;
  }
  return Math.max(0, total);
}

// Attribute XP totals use the attribute snapshot in new reward records;
// legacy entries use the habit's assigned attribute until materialized.
function statTotals(logs, habits) {
  const totals = {};
  STATS.forEach(s => { totals[s.id] = 0; });
  for (const date in logs) {
    for (const habitId in logs[date]) {
      const entry = logs[date][habitId];
      const val = attributeXPOf(entry);
      if (!val) continue;
      const habit = habitById(habits, habitId);
      if (!habit && !(entry && typeof entry === 'object' && entry.attribute)) continue;
      const stat = attributeOf(entry, habit && habit.stat);
      totals[stat] = (totals[stat] || 0) + val;
    }
  }
  return totals;
}

function primaryAttribute(logs, habits) {
  const totals = statTotals(logs, habits);
  const highest = Math.max(0, ...STATS.map(s => totals[s.id] || 0));
  if (highest === 0) return null;
  const latest = {};
  let order = 0;
  Object.keys(logs).sort().forEach(date => {
    Object.keys(logs[date]).forEach(habitId => {
      const entry = logs[date][habitId];
      if (attributeXPOf(entry) <= 0) return;
      const habit = habitById(habits, habitId);
      const stat = attributeOf(entry, habit && habit.stat);
      latest[stat] = ++order;
    });
  });
  const tied = STATS.filter(s => (totals[s.id] || 0) === highest);
  tied.sort((a, b) => (latest[b.id] || 0) - (latest[a.id] || 0));
  return tied[0].id;
}

function levelFromXP(xp) {
  // Each array element is the XP needed to advance from the current level.
  let level = 1;
  let cumulativeXP = 0;
  for (const needed of LEVEL_XP_REQUIREMENTS) {
    if (xp < cumulativeXP + needed) {
      const into = xp - cumulativeXP;
      return { level, into, needed, progress: into / needed };
    }
    cumulativeXP += needed;
    level++;
  }
  return { level: MAX_LEVEL, into: 0, needed: 0, progress: 1 };
}

// A "perfect day" = every habit scheduled that day was completed.
// Days with nothing scheduled don't count as perfect (nothing to prove).
function isPerfectDay(habits, logs, dateISO) {
  const scheduled = habits.filter(h => isScheduledForDate(h, dateISO));
  if (scheduled.length === 0) return false;
  return scheduled.every(h => isCompletedEntry(logs[dateISO] && logs[dateISO][h.id]));
}

// Consecutive perfect-day streak, walking backward from today.
// A date counts toward the streak if it was perfect, was protected by a streak
// freeze, or had nothing scheduled (skipped, doesn't break the chain).
function perfectDayStreak(habits, logs, frozenDates, perfectDays, todayISO) {
  let streak = 0;
  let cursor = new Date(todayISO + 'T00:00:00');
  const todayIsPerfect = !!(perfectDays && perfectDays[todayISO]);
  if (!todayIsPerfect) cursor.setDate(cursor.getDate() - 1);

  for (let i = 0; i < 3650; i++) {
    const dISO = localISO(cursor);
    const scheduled = habits.filter(h => isScheduledForDate(h, dISO));
    if (scheduled.length > 0) {
      const wasPerfect = !!(perfectDays && perfectDays[dISO]);
      const wasFrozen = frozenDates && frozenDates.includes(dISO);
      if (wasPerfect || wasFrozen) streak++;
      else break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

const Gamify = {
  PROGRESSION,
  RANKS, rankFor,
  HUNTER_RANKS, LEVEL_XP_REQUIREMENTS, BASE_XP, MAX_LEVEL, MAX_HABITS, MAX_DAILY_HABIT_XP, rankForLevel, rankForXP, xpForCompletion, xpValueOf,
  STATS, DEFAULT_STAT, CLASS_TIERS, CLASS_TIER_THRESHOLDS, classForAttribute, currentClass,
  isCompletedEntry, progressionRecordFromLegacy, attributeXPOf, attributeOf, masteryXPOf, masteryXPForHabit,
  isScheduledForDate, countCompletions, currentStreak, longestStreak,
  totalXP, statTotals, primaryAttribute, levelFromXP, isPerfectDay, perfectDayStreak,
  lifeClockStats
};
