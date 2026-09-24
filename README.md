# HunterArsenal

A professional, offline-first habit tracker. Track daily/weekly habits, view your history, see statistics, and level up through ranks as you build streaks. Installable as an app from Chrome, works fully offline after first load, and updates the moment you push new code and refresh.

## What's inside
- `index.html` — app shell (all views live in one page, toggled with JS)
- `css/styles.css` — all styling (dark/light themes via CSS variables)
- `js/version.js` — **bump this to ship an update** (see below)
- `js/storage.js` — localStorage data layer (habits, logs, settings, freezes, achievements, backup/restore)
- `js/gamification.js` — XP, difficulty ranks, stats, streaks, perfect-day math
- `js/systemwindow.js` — the holographic HUD popup for level-ups, rank-ups, and unlocks
- `js/app.js` — UI logic, rendering, modals
- `sw.js` — service worker (offline caching + auto-update on refresh)
- `manifest.json` — makes the app installable from Chrome
- `assets/` — logo, custom icon sprite (`habit-icons.svg`), self-hosted fonts (no external CDN calls, so it truly works offline)
- `icons/` — app icons generated from the logo

## Gamification systems
- **Stats** — every habit feeds one of five stats (STR/VIT/INT/PER/CHA), viewable on the Profile tab.
- **Hunter Rank (E–S)** — derived automatically from your Level (thresholds in `Gamify.HUNTER_RANKS`), not manually set. Higher rank means more XP per completion. XP is snapshotted at the moment of each completion, so a later rank-up never rewrites XP already earned.
- **System Window** — a HUD-style popup announces level-ups, Hunter Rank-ups (bigger celebration), per-habit rank-ups, perfect days, penalties, and title unlocks.
- **Perfect Day combo** — completing every scheduled habit in a day earns bonus XP that scales with your combo streak.
- **Streak Freezes** — earned every 7-day perfect combo (capped at 3); also excuses that day's Penalty Quest if spent.
- **Penalty Quests** — missing a scheduled habit costs a small, flat, non-escalating amount of XP (capped per day). Toggleable in Settings.
- **Titles & Achievements** — unlockable titles shown next to your level; equip one from the Profile tab.
- **Sound** — synthesized chimes (Web Audio API, no audio files) for check-offs, level-ups, rank-ups, achievements, and penalties. Off by default; toggle in Settings.

All of this is tuned in one place if you want to adjust the balance: rank thresholds/multipliers live in `Gamify.HUNTER_RANKS` (gamification.js), the achievement list is `ACHIEVEMENTS` in app.js, and the perfect-day/penalty constants are at the top of app.js.

## Deploying to GitHub Pages
1. Create a new GitHub repo (e.g. `hunters-arsenal`) and push all these files to the root of the `main` branch (or `docs/` folder — your choice).
2. In the repo, go to **Settings → Pages**, set the source to your branch/folder, save.
3. Your app will be live at `https://<username>.github.io/<repo-name>/`.
4. Open it in Chrome. You'll see an **Install** icon in the address bar (or menu → "Install Hunter's Arsenal") to add it as an installable app.

## How updates work
This app is designed so that **shipping an update = bump a version number and push**:

1. Make your code changes.
2. Open `js/version.js`, increment `APP_VERSION` (e.g. `1.0.0` → `1.1.0`), and add a new entry to the top of `CHANGELOG` describing what changed.
3. Commit and push to GitHub Pages.
4. Any user who refreshes the app (or reopens the installed app) will:
   - automatically get the new files (the service worker detects the version change, downloads them, and takes over),
   - see a **"What's New"** popup summarizing what changed, the first time they open the app after the update.

No manual cache-clearing needed — the versioned cache name in `sw.js` handles that automatically.

## Data & privacy
All habit data lives in the browser's `localStorage`, on-device only — nothing is sent anywhere. Because of this:
- **Back up regularly** using Settings → Export backup (downloads a JSON file).
- Switching browsers, devices, or clearing site data means starting fresh unless you import a backup.

## Customizing
- **Colors/theme**: edit the CSS variables at the top of `css/styles.css` (`:root` for dark, `[data-theme="light"]` for light).
- **Icons/colors offered when adding a habit**: edit the `ICONS` and `COLORS` arrays at the top of `js/app.js`.
- **Ranks/XP curve**: edit `RANKS` and `levelFromXP` in `js/gamification.js`.
