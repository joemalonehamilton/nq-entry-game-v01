# NQ ENTRY OPS — v0.2 (cockpit redesign)

Static browser training game for NQ market schematics. One card = one trading day,
normalized so the opening 4-minute impulse points up. Study the replay, classify the
day (A1 / A2 / B / C1 / C-F / D2), pick the actual market side, click your entry on
the 5s chart, lock it in, get debriefed.

## Deck

Quality-model deck: 97 cards — A1: 37 · A2: 7 · B: 9 · C: 9 · C-F: 12 · D2: 23

## Run locally

```bash
python3 -m http.server 8910 --bind 127.0.0.1
# open http://127.0.0.1:8910
```

No build step, no backend. Deploys as-is to Vercel (static).

## Files

- `index.html` — HUD, filter strip, chart cockpit, decision rail, modals
- `entry-game-v01.js` — game logic, canvas rendering, scoring, gamification, export
- `entry-pattern-game.css` — dark cockpit theme
- `decks/entry_game_v01_quality_deck.json` — 97-card quality deck (~15.7 MB)
- `CLAUDE_REDESIGN_HANDOFF.md` — the redesign brief this version was built from

## What's new in v0.2

- Dark cockpit HUD: level + XP bar, streak, daily session progress (20-rep goal), avg, win%
- XP bonuses: clean classification, perfect entry, no-chase discipline, fast read; hard mode ×1.25
- 10 badges (D2 Sniper, C-Family Specialist, streaks, full session, etc.) — see STATS
- Post-reveal debrief: grade ring, animated score breakdown bars, answer facts, "what you missed"
- Hard mode (H): hides overlays + live checklist
- Family practice filters, unplayed-only toggle, keyboard cheat sheet (?)
- Frictionless NEXT REP (Enter) → random unplayed card
- Hover crosshair on the 5s execution chart

## Rules preserved from v0.1

- 06:30–06:34 is map only; no valid entry before 06:34. Core game ends 07:20.
- Chart is normalized Open4-up; the answer side is the actual market side.
- C-F and D2 labels are research-derived (quality model v2), not live-proven. D1 excluded.
- Deck schema, scoring model, localStorage keys and the reps-export JSON are unchanged,
  so old progress and exports remain compatible. (One fix: total score is now capped at 10 —
  v0.1 could show 11/10.) Export now also includes the `meta` gamification block (additive).

## Keys

SPACE play/pause · ←/→ step · A/2/B/C/F/D classify · N new-box · L/S/K side ·
click 5s chart = entry · Enter lock-in / next rep · R peek · G random · H hard mode · ? help
