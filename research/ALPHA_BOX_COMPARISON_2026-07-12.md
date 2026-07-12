# Custom Compression Box vs Exact AlgoAlpha

Same Entry Game context, same 5s cards, same edge-hold click, TP15/SL10, chronological holdout.

| Engine | Trigger | Active n | Train n/avg | Test n/avg | Test MAE | Test TP | Timing | Bootstrap 95% |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| custom_compression_36 | break_close | 30 | 20 / +1.25 | 10 / +7.50 | 6.95 | 70.0% | 10s | [+0.00,+15.00] |
| custom_compression_36 | edge_hold | 26 | 17 / +3.24 | 9 / +9.44 | 5.86 | 77.8% | 5s | [+1.11,+15.00] |
| exact_algoalpha_36 | break_close | 14 | 9 / -4.44 | 5 / +0.00 | 8.10 | 40.0% | 35s | [-10.00,+10.00] |
| exact_algoalpha_36 | edge_hold | 13 | 8 / -0.62 | 5 / +10.00 | 6.85 | 80.0% | 25s | [+0.00,+15.00] |
| exact_algoalpha_60 | break_close | 7 | 3 / -10.00 | 4 / -10.00 | 16.31 | 0.0% | 18s | [-10.00,-10.00] |
| exact_algoalpha_60 | edge_hold | 7 | 3 / -10.00 | 4 / +2.50 | 12.75 | 50.0% | 20s | [-10.00,+15.00] |
| exact_algoalpha_99 | break_close | 5 | 5 / +0.00 | 0 / +0.00 | 0.00 | 0.0% | 0s | [+0.00,+0.00] |
| exact_algoalpha_99 | edge_hold | 4 | 4 / +8.75 | 0 / +0.00 | 0.00 | 0.0% | 0s | [+0.00,+0.00] |

## Method

- `custom_compression_36` is the detector used by the July 12 test: 36-bar range, TR-SMA14, max(85, TR×4), six compression bars, 1pt break buffer.
- `exact_algoalpha_99` ports Kevin's sent Pine defaults: len-99 pivots and WMA(abs body) crossunder EMA(abs body) box creation. Exact 36/60 are sensitivity checks, not the original default.
- Both require same-side break inside the labeled primary window and mapped-zone interaction; edge hold enters on the first 5s retest close within 24 bars.
- Exact-engine EMA seeding follows the Pine reference-style source seed; pivot and box state are causal and invariant-checked.

## Verdict

- **Custom compression-36 wins for the current 5s Entry Game context.** Edge hold: train n=17, +3.24; active holdout n=9, +9.44, MAE 5.86, TP 77.8%, median timing error 5s.
- The exact sent default (`len=99`) produced only four active edge-hold examples before the split and **zero holdout signals**. Its pivot confirmation plus 99-bar body-volatility smoothing is too slow/sparse for these short day-specific click windows.
- Exact-engine `len=36` is a sensitivity check, not Kevin's original default. It looked good only in the tiny holdout (n=5, +10.00, MAE 6.85) but failed train (n=8, -0.62), so it does not pass robustness.
- On four paired active holdout days, custom and exact36 tied at +8.75 points/trade and 75% TP, but custom had lower MAE (6.75 vs 8.06) and earlier timing (12.5s vs 22.5s).
- Visual audit: the custom box more often breaks/retests around the labeled launch. Exact boxes are sparser and sometimes arrive after the useful structural transition; July 2 exact36 was 105s late and stopped.
- Use the custom box as the **execution box**. Keep original AlgoAlpha boxes as broader context only unless a separately tuned timeframe/length survives forward testing.

Visual audit: `/Users/kevinhe/.hermes/workspace/openclaw-main/strategy-lab/dragon_entry_game/reports/alpha_box_engine_comparison_2026-07-12/visual_audit_custom_vs_exact.png`

Paired active holdout edge-hold days (custom vs exact99): 0.
Events: `/Users/kevinhe/.hermes/workspace/openclaw-main/strategy-lab/dragon_entry_game/reports/alpha_box_engine_comparison_2026-07-12/events.csv`
Summary: `/Users/kevinhe/.hermes/workspace/openclaw-main/strategy-lab/dragon_entry_game/reports/alpha_box_engine_comparison_2026-07-12/summary.csv`
