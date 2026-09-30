# HunterArsenal — Codex Project Instructions

## Project

HunterArsenal is a vanilla JavaScript PWA habit tracker with a dark futuristic System/HUD visual language.

Repository:
https://github.com/melhive/hunters-arsenal/

Live:
https://melhive.github.io/hunters-arsenal/

Authoritative working directory:
`~/Projects/hunters-arsenal`

Treat this as the only active working copy unless explicitly instructed otherwise.
Do not use `~/Documents/hunters-arsenal` unless explicitly requested.

---

## Core Development Rules

1. Preserve the existing architecture.
2. Make the smallest change necessary for the requested task.
3. Do not rewrite unrelated systems.
4. Do not introduce frameworks, dependencies, or build systems unless explicitly requested.
5. Reuse existing functions, CSS, assets, and patterns whenever possible.
6. One requested visual change = one controlled change.
7. Test locally before deployment.
8. Never automatically commit or push.
9. Never use `git restore .` unless explicitly requested.
10. Never discard existing user changes.
11. Never delete assets without verifying their usage.
12. Do not modify unrelated UI.

---

## Git Safety

Before changes:

```bash
git status
```

The user controls commits and pushes.

Never:
- auto-commit
- auto-push
- reset the repository
- discard changes
- restore the entire working tree

Preferred checkpoint:

```bash
git add <specific-files>
git commit -m "<focused checkpoint>"
```

---

## UI Lock Rule

The approved UI is locked by default.

When modifying one UI element:
- Change only that element and necessary supporting code.
- Do not move unrelated elements.
- Do not redesign surrounding screens.
- Do not introduce new navigation structures.
- Do not introduce new currencies or progression systems.
- Preserve existing spacing, hierarchy, mechanics, and behavior.

If a broad architectural change is necessary, explain why before making it.

---

## Official Branding

Official HA emblem:

`assets/branding/hunterarsenal-logo.png`

Use the official emblem consistently for appropriate application branding:
- Home header
- loading/splash screen
- favicon
- browser icon
- PWA manifest icons
- installed PWA/app icon
- Apple touch icon where applicable

Do not replace unrelated icons or artwork.
Do not recolor or distort the master logo.
Do not delete the master logo.
Create separate derived assets when optimized/resized/transparent variants are needed.

Official wordmark:
`HunterArsenal`

Preserve its existing typography and Arsenal-blue treatment unless explicitly requested otherwise.

---

## System Blue Visual Language

Primary hierarchy:
- near-black / obsidian
- deep navy
- dark blue
- System Blue
- electric blue
- small cyan/white-blue highlights

The primary accent is the blue associated with the Arsenal portion of the HunterArsenal branding.

Use the established primary blue for:
- XP progress
- Today's Quests progress
- completed check buttons
- plus button
- Quest Notification
- System Notices
- primary System highlights

Do not introduce random blue gradients.

Semantic colors:
- STR: red
- VIT: green
- INT: blue/cyan
- PER: violet
- CHA: gold
- Class: violet
- Title: gold/amber
- Danger: red
- Warning: gold
- Success: green

---

## Home Header

Required structure:

`[HA LOGO] HunterArsenal                    [QUEST STATUS]`

Rules:
- HA emblem and wordmark remain together.
- Quest Notification remains on the right.
- Quest Notification is normal document flow.
- Not fixed.
- Not sticky.
- No overlap.
- Opening a System Window must not horizontally shift the header.
- Avoid first-paint layout shift.

Only the Quest Notification may be repositioned when explicitly requested.

---

## Home Background

The Home environment is a dark futuristic System Blue environment with futuristic structures, luminous blue moon/energy source, atmospheric blue haze, and HUD geometry.

Do not replace or redesign the background unless explicitly requested.

---

## Character Assets

Main hunter:
`assets/characters/hunter-main.png`

Today's Quests hunter:
`assets/characters/hunter-quest.png`

Layering:

`Background → Atmospheric/HUD → Main hunter → Home UI`

Main hunter:
- upper-right
- behind UI
- in front of background
- pointer-events: none
- must not affect layout
- must not create horizontal overflow
- must be clipped to its intended upper visual stage

Today's Quests hunter:
- inside Today's Quests card
- right side
- behind content
- clipped to card
- subdued
- text must remain readable
- must not change card dimensions

Current character positioning, color treatment, and visibility are approved. Do not retune them unless explicitly requested.

### Main Hunter Scroll Rule

The main hunter must never leak into lower Home sections while scrolling.

Use a dedicated visual-stage/container with appropriate clipping.

Do NOT solve this with:
- position: fixed
- JavaScript scroll handlers
- scroll-triggered hiding
- arbitrary timeouts
- display:none
- scroll-triggered opacity

The Home page must continue scrolling normally. Only the character layer should be clipped.

---

## Card Border System

Approved card border:
- thin structural blue border
- angular/cut corners
- geometric corner steps
- localized corner glow
- restrained straight border sections
- dark uniform interior

Used by:
- Level / XP card
- Today's Quests card
- Habit cards

Reuse the existing implementation. Do not invent a second border system.

---

## Quest Notification

Approved treatment:
- dark deep-blue/near-black interior
- thin electric-blue holographic border
- localized blue glow
- bright System Blue text
- small blue status dot
- restrained border

System Notices use the same System Blue language.

Opening a System Window must not shift the Home header.

---

## Daily Quest Mechanics

Daily Quests must map dynamically to existing habits. Do not invent unrelated tasks.

Lifecycle:

`SCHEDULE → AVAILABLE → ACCEPT / DECLINE → ACTIVE → COMPLETE / FAIL → CYCLE FINISHED → USER CAN SCHEDULE NEXT QUEST → NEXT CYCLE`

AVAILABLE:
- informational
- no checkboxes

ACCEPT:
- accepted state
- checkboxes appear
- tasks map to actual habits

ACTIVE:
- checkbox state uses the underlying habit state
- no separate quest-only habit database
- X hides/minimizes the notice
- X does not cancel the quest

DECLINE:
- no direct XP deduction
- does not permanently destroy the quest

Missed scheduled popup:
- next app open
- System Notice after approximately 2 seconds
- same missed cycle must not repeatedly trigger

CAUTION:
`CAUTION`

`Every second drains your lifespan. Spend your time wisely.`

Reward:
`+25 BONUS XP`

Risk:
`2× PENALTY IF FAILED`

Existing values:
- `QUEST_CLEAR_BONUS = 25`
- `QUEST_FAIL_MULTIPLIER = 2`
- `PENALTY_PER_MISS = 8`
- `PENALTY_CAP = 30`

Do not modify these mechanics during unrelated UI work.

---

## Home Countdown

Display:

`HH:MM:SS`
`TIME LEFT TODAY`

Rules:
- updates every second
- local day end
- no second current-time display
- right side of Daily Quest Log row
- compact rectangular System Blue frame
- no unnecessary decorations
- no first-paint layout shift

---

## Navigation Branding

| Tab | HA Logo + Name | Plus |
|---|---|---|
| Home | Keep | Keep |
| History | Remove | Remove |
| Stats | Remove | Remove |
| Profile | Remove | Remove |
| Settings | Remove | Remove |

Bottom navigation remains unchanged unless explicitly requested.

---

## Progression

Attributes:
- STR — Strength
- VIT — Vitality
- INT — Intellect
- PER — Perception
- CHA — Charisma

Habit Mastery:
`AWAKENED → FORGED → HUNTER → VETERAN → ELITE → APEX → ASCENDANT`

Do not introduce new currencies or progression systems without explicit approval.

Hunter Credits (HC) are cosmetic currency.

---

## Themes

System Blue is the default.

Ocean:
`deep blue → teal → cyan`

Void:
`black → indigo → violet → light violet`

Verdant:
`black → forest → emerald → light emerald`

Themes should remain multi-color.

---

## PWA

Preserve:
- `manifest.json`
- service worker
- installability
- offline behavior
- existing caching strategy

When changing branding inspect:
- `manifest.json`
- `index.html`
- favicon
- Apple touch icon
- service worker if necessary

Do not introduce Android Studio, Capacitor, or native wrappers unless explicitly requested.

---

## Important Files

```text
assets/
css/
icons/
js/
index.html
manifest.json
sw.js
README.md
AGENTS.md
```

Important JS:
```text
js/version.js
js/storage.js
js/gamification.js
js/systemwindow.js
js/app.js
```

Reuse existing architecture.

---

## Testing

Local server:

```bash
cd ~/Desktop/hunters-arsenal
python3 -m http.server 8080
```

For visual changes:
1. Make one controlled change.
2. Run locally.
3. Take a screenshot.
4. Compare with the locked design.
5. Only then make another adjustment.

Test mobile and desktop where practical.

---

## Codex Task Procedure

Before editing:
1. Inspect relevant files.
2. Identify the existing implementation.
3. Reuse it.
4. Make the smallest scoped change.
5. Test it.
6. Report changed files and relevant selectors/functions.

Do not modify unrelated files.

When uncertain, preserve existing behavior and report the uncertainty instead of redesigning.

---

## Current Locked Visuals

Currently approved:
- System Blue environment
- Main hunter integration
- Today's Quests hunter integration
- Quest Notification placement
- Home countdown
- Home navigation
- card border language
- official HA emblem direction
- Home header structure
- Daily Quest mechanics

Do not regress these while implementing new work.

---

## Development Principle

HunterArsenal evolves through controlled, verifiable changes.

Priority:
1. Preserve working behavior.
2. Preserve locked visuals.
3. Make the smallest requested change.
4. Test locally.
5. Checkpoint approved milestones.
6. Never silently redesign the application.
