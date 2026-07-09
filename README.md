# NQ Entry Game v0.1

Static browser training game for NQ market schematics.

Live app: https://nq-entry-game-v01.vercel.app

## Deck

Quality-model v0.1 deck: 97 cards

- A1: 37
- A2: 7
- B: 9
- C: 9
- C-F: 12
- D2: 23

## Run locally

```bash
python3 -m http.server 8910 --bind 127.0.0.1
open http://127.0.0.1:8910
```

## Files

- `index.html` — static app shell
- `entry-game-v01.js` — game logic, canvas chart rendering, scoring, export
- `entry-pattern-game.css` — base styles
- `decks/entry_game_v01_quality_deck.json` — 97-card deck
- `CLAUDE_REDESIGN_HANDOFF.md` — prompt/brief for redesigning and gamifying the UI

## Claude redesign brief

If using Claude/Claude Code, start with:

```text
Read CLAUDE_REDESIGN_HANDOFF.md first. Redesign and gamify this static NQ Entry Game UI. Preserve the deck schema, chart replay, scoring, correction/export flow, and static Vercel deployability. Make it feel like an addictive dark trading cockpit training game, not an audit page. Test locally before finishing.
```
