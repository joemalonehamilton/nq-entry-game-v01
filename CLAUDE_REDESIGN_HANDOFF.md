# Claude Redesign Handoff — NQ Entry Game v0.1

You are redesigning and gamifying a static browser training game for NQ market schematics.

Live current version:
https://nq-entry-game-v01.vercel.app

Source files in this folder:
- `index.html` — static shell
- `entry-game-v01.js` — all app/game logic, canvas chart rendering, scoring, localStorage, export
- `entry-pattern-game.css` — existing base CSS
- `decks/entry_game_v01_quality_deck.json` — 97-card data deck, ~15.7MB

## Product Context

This is a trader training game. One card = one NQ trading day. The chart is normalized so the first 4-minute opening impulse points UP. User studies the replay, classifies the day, picks actual market side, clicks their entry, then reveals/scoring.

Families in the deck:
- A1: clean retest continuation
- A2: no-retest / drive continuation
- B: failed-A scalp
- C: true AMD high-take
- C-F: C attempt / C failure scalp
- D2: bull-trap / upside continuation trap

Current deck counts:
- A1: 37
- A2: 7
- B: 9
- C: 9
- C-F: 12
- D2: 23

Rules:
- 06:30-06:34 is map only; no entry before 06:34.
- Core game cutoff is 07:20.
- Chart is normalized Open4-up, but the answer side is actual market side.
- Quality deck excludes D1. D1 is research-only.
- C-F is useful but still research / needs live predictor.

## Current App Behavior To Preserve

Must preserve:
- Loads `decks/entry_game_v01_quality_deck.json`
- Step/play replay controls
- 1m parent chart and 5s execution chart
- Candlestick canvas rendering
- Open4 rails, MB/LVN zones, alpha boxes
- Click entry on 5s chart
- Pick schematic + LONG/SHORT/SKIP
- Reveal answer/scoring
- Notes field
- localStorage persistence
- Export reps JSON
- No backend required
- Must deploy as static Vercel app

## Redesign Goals

Make it feel like an actual addictive trading training game, not a utilitarian audit page.

Design target:
- dark cockpit / prop-firm simulator
- fast reps
- keyboard-first
- high contrast but not noisy
- charts are the hero
- scoring should feel satisfying
- progress should be obvious
- user should want to do 20 reps

Gamification ideas to implement if possible:
- XP / level / streaks
- daily session progress
- per-family accuracy cards
- speed bonus, but do not encourage pre-06:34 entries
- badges for clean classification, perfect entry, no-chase discipline, D2 sniper, C-family specialist
- post-reveal feedback panel with “what you missed”
- hard mode toggle: hide overlays/hints
- practice filters by family
- keyboard cheat sheet
- “next rep” flow that is frictionless

UX problems in current version:
- UI is dense and visually old
- side panel is too busy
- controls don’t feel game-like
- scoring is functional but not rewarding
- category buttons are cramped
- chart hierarchy can be better
- reveal/submit flow can be more satisfying
- notes/export should be available but secondary

## Constraints

Important:
- Keep it static HTML/CSS/JS unless you intentionally convert it to a small Vite/React app.
- If converting, keep deployment simple for Vercel.
- Do not break the deck schema unless you also update the loader.
- Do not invent market stats or change training labels.
- Do not remove correction/export workflow.
- Do not hide the fact that C-F and D2 are research-derived labels.
- Keep data local/public; no auth/backend for now.

Preferred implementation:
- Make a clean redesigned version rather than tiny CSS tweaks.
- You may refactor JS into modules if useful.
- Use semantic structure and CSS variables.
- Preserve canvas chart functionality.
- Test locally before final.

## Deliverables

Please produce:
1. A redesigned/gamified UI that runs locally and on Vercel.
2. Clear summary of changed files.
3. Verification steps run.
4. Any known caveats.

## Suggested Design Direction

Think: “Bloomberg terminal meets rhythm game training cockpit.”

Visual language:
- deep black / charcoal base
- electric green for correct/long/success
- danger red for short/wrong
- amber for discipline/warnings
- blue/cyan for map/alpha/active state
- high-quality typography, strong numeric treatment
- less boxed-card clutter; more HUD hierarchy
- motion should clarify reveal/scoring, not distract

Primary screen hierarchy:
1. Chart/replay area dominates.
2. Compact top HUD: rep count, streak, score, family filter.
3. Right rail: current decision only.
4. Reveal panel becomes a satisfying debrief.
5. History/progress tucked but visible.

Scoring model can stay the same internally, but presentation should feel better.

## Quick Run

From this folder:

```bash
python3 -m http.server 8910 --bind 127.0.0.1
open http://127.0.0.1:8910
```

Verify:
- page loads
- deck loads 97 cards
- buttons work
- play/step works
- chart renders
- click entry works
- submit/reveal works
- export JSON works

