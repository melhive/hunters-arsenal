/*
  Single source of truth for the app version + changelog.
  - Bump APP_VERSION whenever you ship a change.
  - Add a new entry to the top of CHANGELOG describing what changed.
  - The service worker uses APP_VERSION to name its cache, so bumping it
    forces every client to fetch fresh files on next load.
  - The app uses CHANGELOG to show the "What's New" screen automatically
    the first time a user opens the app after an update.
*/

self.APP_VERSION = '2.1.0';

self.CHANGELOG = [
  {
    version: '2.1.0',
    date: '2026-09-16',
    changes: [
      'Rebalanced Hunter Rank pacing \u2014 a consistent hunter can now reach S-Rank in about a year, instead of several.',
      'Earlier ranks come faster too: D-Rank in ~2 weeks, C in ~6 weeks, B in ~3 months, A in ~6 months at typical consistency.'
    ]
  },
  {
    version: '2.0.0',
    date: '2026-09-15',
    changes: [
      'Hunter Rank overhaul \u2014 your rank (E through S) is now derived automatically from your Level, not manually chosen. Higher rank means more XP per quest.',
      'A bigger RANK UP celebration, separate from the regular level-up, for these rarer milestones.',
      'Penalty Quests \u2014 missing a scheduled habit costs a small, one-time amount of XP (no escalation). Toggleable in Settings.',
      'Streak Freezes now also excuse a Penalty Quest for that day.',
      'Sound effects \u2014 synthesized chimes for check-offs, level-ups, rank-ups, achievements, and penalties. Off by default; enable it in Settings.',
      'Habit cards now show a live "+XP" value instead of a fixed difficulty badge.'
    ]
  },
  {
    version: '1.5.0',
    date: '2026-09-14',
    changes: [
      'Drag to reorder habits \u2014 grab the handle on any Dashboard card to rearrange your roster.',
      'Works with touch and mouse alike.'
    ]
  },
  {
    version: '1.4.0',
    date: '2026-09-14',
    changes: [
      'Micro-interaction polish \u2014 habits now bounce and ripple when checked off.',
      'Confetti burst on level-ups and rank-ups.',
      'Dashboard and Profile now ease in with a staggered entrance when you open them.'
    ]
  },
  {
    version: '1.3.0',
    date: '2026-09-14',
    changes: [
      'Fixed icons not displaying \u2014 stat icons, achievement badges, and the hunter avatar were rendering empty for some users.',
      'Brand new logo \u2014 a guild-crest shield with a two-tone flame mark.',
      'The hunter avatar (Profile and onboarding) now shows a generic hunter icon instead of an empty circle.'
    ]
  },
  {
    version: '1.2.1',
    date: '2026-09-14',
    changes: [
      'New logo \u2014 a cleaner tactical badge mark, replacing the old crosshair design.',
      'Refreshed app icons and favicon to match, including the loading screen.'
    ]
  },
  {
    version: '1.2.0',
    date: '2026-09-14',
    changes: [
      'New Hunter onboarding intro for first-time launches.',
      'Archive habits instead of deleting them \u2014 history is kept, with one-tap Undo.',
      'Yearly heatmap on the History tab \u2014 a full year of completions at a glance.',
      'Settings now has an Archived Habits section to restore or permanently remove.'
    ]
  },
  {
    version: '1.1.0',
    date: '2026-09-13',
    changes: [
      'New Hunter Profile tab \u2014 five stats (STR/VIT/INT/PER/CHA) fed by your habits.',
      'Difficulty ranks (E through S) \u2014 harder habits now earn more XP.',
      'System Window pop-ups for level-ups, rank-ups, and unlocks.',
      'Perfect Day combo bonus \u2014 finish every habit in a day for bonus XP.',
      'Streak Freeze tokens to protect your combo after a missed day.',
      'Titles & Achievements \u2014 unlock and equip a title next to your level.',
      'Replaced emoji icons with a custom line-icon set for a cleaner look.'
    ]
  },
  {
    version: '1.0.0',
    date: '2026-09-13',
    changes: [
      'Launched Hunter\u2019s Arsenal \u2014 your habit tracking command center.',
      'Dashboard with today\u2019s roster, streaks, and daily completion.',
      'History view with a weekly completion heatmap.',
      'Statistics with completion trends and per-habit mastery.',
      'Custom habits with icons, colors, and flexible schedules.',
      'Rank & XP system \u2014 level up each habit from Recruit to Legendary.',
      'Dark and light mode, full offline support, installable app.'
    ]
  }
];
