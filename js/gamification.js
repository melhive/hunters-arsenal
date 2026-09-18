/* Ranks, XP, stats, streaks, perfect-day, and penalty math. Pure functions — no DOM, no storage writes. */

// Per-habit "mastery" rank — how proficient you've become at ONE specific
// habit, based on how many times you've completed it. Unrelated to Hunter Rank.
const RANKS = [
  { name: 'Recruit', min: 0, icon: 'ic-smile' },
  { name: 'Cadet', min: 10, icon: 'ic-target' },
  { name: 'Marksman', min: 25, icon: 'ic-star' },
  { name: 'Sharpshooter', min: 50, icon: 'ic-shield' },
  { name: 'Elite', min: 100, icon: 'ic-flame' },
  { name: 'Legendary', min: 200, icon: 'ic-trophy' }
];

// Hunter Rank — YOUR overall rank, derived automatically from Level. Not
// manually set. Higher rank means every completion earns more XP, via the
// multiplier below. Thresholds are tuned so a genuinely consistent hunter
// (a handful of habits, most days) reaches S-Rank within roughly a year —
// see js/version.js changelog for the tuning pass. Multiplier stays modest
// (1.0x-2.2x) so it accelerates progress without ever runaway/snowballing.
const HUNTER_RANKS = [
  { id: 'E', label: 'E-Rank', minLevel: 1, multiplier: 1.0, color: '#8b959c' },
  { id: 'D', label: 'D-Rank', minLevel: 3, multiplier: 1.2, color: '#5eb1e8' },
  { id: 'C', label: 'C-Rank', minLevel: 6, multiplier: 1.4, color: '#7cd45e' },
  { id: 'B', label: 'B-Rank', minLevel: 9, multiplier: 1.6, color: '#c78ce8' },
  { id: 'A', label: 'A-Rank', minLevel: 13, multiplier: 1.8, color: '#e8a33d' },
  { id: 'S', label: 'S-Rank', minLevel: 17, multiplier: 2.2, color: '#e8636c' }
];
const BASE_XP = 10;

function rankForLevel(level) {
  let current = HUNTER_RANKS[0];
  for (const r of HUNTER_RANKS) {
    if (level >= r.minLevel) current = r;
  }
  return current;
}

// XP a single habit completion is worth RIGHT NOW, given the hunter's
// current level. This value gets snapshotted into the log entry at the
// moment of completion (see Store.toggle) — future rank changes only affect
// FUTURE completions, never rewrite XP already earned.
function xpForCompletion(level) {
  return Math.round(BASE_XP * rankForLevel(level).multiplier);
}

// A log entry may be a plain `true` (habits completed before this XP system
// existed) or a snapshotted XP number. This normalizes either to a number.
function xpValueOf(entry) {
  if (entry === true) return BASE_XP; // legacy completions, treated as base-rate
  if (typeof entry === 'number' && entry > 0) return entry;
  return 0;
}

// The five hunter stats. Every habit feeds exactly one.
const STATS = [
  { id: 'STR', label: 'Strength', icon: 'ic-dumbbell' },
  { id: 'VIT', label: 'Vitality', icon: 'ic-droplet' },
  { id: 'INT', label: 'Intellect', icon: 'ic-book' },
  { id: 'PER', label: 'Perception', icon: 'ic-target' },
  { id: 'CHA', label: 'Charisma', icon: 'ic-star' }
];
const DEFAULT_STAT = 'STR';

// Flavor-only "Class" tag: whichever stat you've invested the most XP in
// determines your current archetype tier. This is purely descriptive (not
// an unlockable achievement) — it just reflects your current build, and can
// change if your focus shifts. Tiers scale with that ONE stat's own XP,
// independent of overall Hunter Rank.
const CLASS_TIERS = {
  STR: ['Brawler', 'Berserker', 'Warbringer', 'Juggernaut', 'Titan'],
  VIT: ['Survivor', 'Ironclad', 'Bulwark', 'Immortal', 'Colossus'],
  INT: ['Scholar', 'Analyst', 'Strategist', 'Savant', 'Archon'],
  PER: ['Initiate', 'Tracker', 'Sentinel', 'Seer', 'Oracle'],
  CHA: ['Novice', 'Speaker', 'Envoy', 'Luminary', 'Sovereign']
};
const CLASS_TIER_THRESHOLDS = [30, 120, 350, 800, 1600]; // XP in that one stat
const CLASS_MIN_XP = CLASS_TIER_THRESHOLDS[0];

// Given per-stat XP totals (from statTotals), returns the current dynamic
// Class tag, or null if no stat has enough XP yet to have a class at all.
function currentClass(statTotals) {
  let bestStat = null, bestXP = 0;
  STATS.forEach(s => {
    const xp = statTotals[s.id] || 0;
    if (xp > bestXP) { bestXP = xp; bestStat = s.id; }
  });
  if (!bestStat || bestXP < CLASS_MIN_XP) return null;

  const tiers = CLASS_TIERS[bestStat];
  let tierIndex = 0;
  for (let i = 0; i < CLASS_TIER_THRESHOLDS.length; i++) {
    if (bestXP >= CLASS_TIER_THRESHOLDS[i]) tierIndex = i;
  }
  const nextThreshold = CLASS_TIER_THRESHOLDS[tierIndex + 1] || null;
  return {
    stat: bestStat,
    name: tiers[tierIndex],
    tier: tierIndex + 1,
    xp: bestXP,
    nextThreshold,
    progress: nextThreshold ? (bestXP - CLASS_TIER_THRESHOLDS[tierIndex]) / (nextThreshold - CLASS_TIER_THRESHOLDS[tierIndex]) : 1
  };
}

function rankFor(completions) {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (completions >= r.min) current = r;
  }
  const idx = RANKS.indexOf(current);
  const next = RANKS[idx + 1] || null;
  const progress = next ? (completions - current.min) / (next.min - current.min) : 1;
  return { ...current, next, progress: Math.min(1, Math.max(0, progress)), completions };
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
    if (logs[date][habitId]) count++;
  }
  return count;
}

function localISO(d) {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function currentStreak(habit, logs, todayISO) {
  let streak = 0;
  let cursor = new Date(todayISO + 'T00:00:00');
  // If today isn't done yet but is scheduled, start checking from yesterday
  // so an unfinished "today" doesn't zero out an active streak mid-day.
  const todayDone = !!(logs[todayISO] && logs[todayISO][habit.id]);
  if (!todayDone) cursor.setDate(cursor.getDate() - 1);

  for (let i = 0; i < 3650; i++) {
    const dISO = localISO(cursor);
    if (isScheduledForDate(habit, dISO)) {
      const done = !!(logs[dISO] && logs[dISO][habit.id]);
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
      const done = !!(logs[dISO] && logs[dISO][habit.id]);
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

// Total XP = every completion's SNAPSHOTTED xp value (not recomputed from
// current rank — see xpForCompletion's comment) + perfect-day bonuses -
// penalties, floored at 0.
function totalXP(logs, perfectDays, penalties) {
  let total = 0;
  for (const date in logs) {
    for (const habitId in logs[date]) {
      total += xpValueOf(logs[date][habitId]);
    }
  }
  if (perfectDays) {
    for (const date in perfectDays) total += perfectDays[date] || 0;
  }
  if (penalties) {
    for (const date in penalties) total -= penalties[date] || 0;
  }
  return Math.max(0, total);
}

// XP earned broken down by stat, for the Hunter Profile stat bars.
// Uses each habit's CURRENT stat assignment (editing a habit's stat later
// reclassifies its past XP — a reasonable, simple behavior).
function statTotals(logs, habits) {
  const totals = {};
  STATS.forEach(s => { totals[s.id] = 0; });
  for (const date in logs) {
    for (const habitId in logs[date]) {
      const val = xpValueOf(logs[date][habitId]);
      if (!val) continue;
      const habit = habitById(habits, habitId);
      if (!habit) continue;
      const stat = habit.stat || DEFAULT_STAT;
      totals[stat] = (totals[stat] || 0) + val;
    }
  }
  return totals;
}

function levelFromXP(xp) {
  // Simple curve: each level needs 100 more XP than the last.
  let level = 1;
  let needed = 100;
  let remaining = xp;
  while (remaining >= needed) {
    remaining -= needed;
    level++;
    needed += 100;
  }
  return { level, into: remaining, needed, progress: remaining / needed };
}

// A "perfect day" = every habit scheduled that day was completed.
// Days with nothing scheduled don't count as perfect (nothing to prove).
function isPerfectDay(habits, logs, dateISO) {
  const scheduled = habits.filter(h => isScheduledForDate(h, dateISO));
  if (scheduled.length === 0) return false;
  return scheduled.every(h => !!(logs[dateISO] && logs[dateISO][h.id]));
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
  RANKS, rankFor,
  HUNTER_RANKS, BASE_XP, rankForLevel, xpForCompletion, xpValueOf,
  STATS, DEFAULT_STAT, CLASS_TIERS, currentClass,
  isScheduledForDate, countCompletions, currentStreak, longestStreak,
  totalXP, statTotals, levelFromXP, isPerfectDay, perfectDayStreak
};
