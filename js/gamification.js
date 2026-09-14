/* Ranks, XP, stats, streaks, and perfect-day math. Pure functions — no DOM, no storage writes. */

const RANKS = [
  { name: 'Recruit', min: 0, icon: 'ic-smile' },
  { name: 'Cadet', min: 10, icon: 'ic-target' },
  { name: 'Marksman', min: 25, icon: 'ic-star' },
  { name: 'Sharpshooter', min: 50, icon: 'ic-shield' },
  { name: 'Elite', min: 100, icon: 'ic-flame' },
  { name: 'Legendary', min: 200, icon: 'ic-trophy' }
];

// Solo-Leveling-style difficulty ranks. Higher rank = more XP per completion.
const DIFFICULTIES = [
  { id: 'E', label: 'E-Rank', xp: 10 },
  { id: 'D', label: 'D-Rank', xp: 15 },
  { id: 'C', label: 'C-Rank', xp: 25 },
  { id: 'B', label: 'B-Rank', xp: 40 },
  { id: 'A', label: 'A-Rank', xp: 60 },
  { id: 'S', label: 'S-Rank', xp: 100 }
];
const DEFAULT_DIFFICULTY = 'E';

function xpForDifficulty(diffId) {
  const d = DIFFICULTIES.find(x => x.id === diffId);
  return d ? d.xp : DIFFICULTIES[0].xp;
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

// Total XP = sum of every completion's difficulty-based XP + all awarded perfect-day bonuses.
function totalXP(logs, habits, perfectDays) {
  let total = 0;
  for (const date in logs) {
    for (const habitId in logs[date]) {
      if (!logs[date][habitId]) continue;
      const habit = habitById(habits, habitId);
      total += xpForDifficulty(habit ? habit.difficulty : DEFAULT_DIFFICULTY);
    }
  }
  if (perfectDays) {
    for (const date in perfectDays) total += perfectDays[date] || 0;
  }
  return total;
}

// XP earned broken down by stat, for the Hunter Profile stat bars.
function statTotals(logs, habits) {
  const totals = {};
  STATS.forEach(s => { totals[s.id] = 0; });
  for (const date in logs) {
    for (const habitId in logs[date]) {
      if (!logs[date][habitId]) continue;
      const habit = habitById(habits, habitId);
      if (!habit) continue;
      const stat = habit.stat || DEFAULT_STAT;
      totals[stat] = (totals[stat] || 0) + xpForDifficulty(habit.difficulty);
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
  RANKS, DIFFICULTIES, DEFAULT_DIFFICULTY, xpForDifficulty,
  STATS, DEFAULT_STAT,
  rankFor, isScheduledForDate, countCompletions, currentStreak, longestStreak,
  totalXP, statTotals, levelFromXP, isPerfectDay, perfectDayStreak
};
