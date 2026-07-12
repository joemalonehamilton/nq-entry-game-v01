# 5s Execution Box Optimizer

Selection lock: DEV/VAL only. Frozen TEST was not used to rank Stage 1 or Stage 2.

- Stage 1 architectures: 1104
- Stage 2 refinements: 2592
- Active cards: 53

## Frozen finalists

| Model | DEV n/avg/MAE | VAL n/avg/MAE | TEST n/avg/MAE/TP | Timing | Width | Positive months | Paired better/worse/ΔMAE | 95% CI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| abs-hl-L36-A14-M4-P85-Q0.35-C3-B0.25-D18-R24-H0.5-K0 | 10/+2.50/7.60 | 5/+15.00/2.40 | 9/+9.44/5.42/77.8% | 10s | 69.8 | 3/4 | 1/3/+0.44 | [+1.11,+15.00] |
| floor-hl-L36-A14-M4-P85-Q0.35-C6-B1-D18-R24-H1-K0 | 12/+0.42/8.85 | 5/+10.00/5.60 | 9/+9.44/5.86/77.8% | 5s | 63.5 | 2/4 | 0/0/+0.00 | [+1.11,+15.00] |
| floor-hl-L36-A14-M4-P85-Q0.35-C6-B0.25-D18-R24-H0.5-K0 | 9/+3.89/7.17 | 5/+15.00/2.80 | 9/+9.44/6.28/77.8% | 5s | 60.2 | 3/4 | 0/3/-0.42 | [+1.11,+15.00] |
| floor-hl-L60-A21-M2.5-P85-Q0.35-C3-B0.25-D18-R18-H0.5-K0 | 10/+7.50/6.38 | 4/+8.75/5.44 | 5/+0.00/8.05/40.0% | 10s | 75.0 | 3/4 | 0/2/-1.85 | [-10.00,+10.00] |
| floor-hl-L60-A21-M4-P85-Q0.35-C3-B0.25-D18-R18-H0.5-K0 | 10/+7.50/6.38 | 4/+8.75/5.44 | 5/+0.00/8.05/40.0% | 10s | 75.0 | 3/4 | 0/2/-1.85 | [-10.00,+10.00] |
| abs-hl-L60-A14-M4-P85-Q0.35-C3-B0.25-D18-R18-H0.5-K0 | 10/+7.50/6.38 | 4/+8.75/5.44 | 5/+0.00/8.05/40.0% | 10s | 75.0 | 3/4 | 0/2/-1.85 | [-10.00,+10.00] |
| floor-close-L60-A21-M2.5-P85-Q0.35-C3-B1-D12-R12-H0.5-K0 | 10/+7.50/6.53 | 4/+8.75/4.94 | 8/-0.62/9.88/37.5% | 35s | 77.4 | 4/4 | 0/4/-3.75 | [-6.88,+8.75] |
| floor-close-L60-A21-M4-P85-Q0.35-C3-B1-D12-R12-H0.5-K0 | 10/+7.50/6.53 | 4/+8.75/4.94 | 8/-0.62/9.88/37.5% | 35s | 77.4 | 4/4 | 0/4/-3.75 | [-6.88,+8.75] |
| abs-close-L60-A14-M4-P85-Q0.35-C3-B1-D12-R12-H0.5-K0 | 10/+7.50/6.53 | 4/+8.75/4.94 | 8/-0.62/9.88/37.5% | 35s | 77.4 | 4/4 | 0/4/-3.75 | [-6.88,+8.75] |

## Promotion decision

- **No candidate clears promotion. Keep compression-36 v1.**
- Promotion required positive DEV/VAL/TEST, TEST n≥6, lower TEST MAE than baseline, stable pre-test months, and MAE improvement on at least two paired holdout days—not one lucky date.

## Frozen-holdout audit

- The best frozen challenger kept the same nine trades, +9.44 average, and 77.8% TP as v1. MAE fell only from 5.86 to 5.42.
- That apparent MAE gain was not broad: one day improved, three worsened, and five were unchanged. Paired mean improvement was +0.44 points with bootstrap 95% interval [-0.89,+2.47] and only 63.3% probability of being positive.
- The improvement came from one July 6 entry; selecting the nearby setting with still lower TEST MAE would be holdout leakage.
- Longer 60-bar architectures looked excellent in DEV/VAL (+7.50/+8.75) but collapsed to 0.00 or -0.62 points/trade on frozen TEST. Close-range variants were especially fragile.
- Conclusion: there is a useful paper hypothesis—absolute 85-point compression, three confirmation bars, 0.5-point close tolerance—but no production-grade box upgrade. Keep v1 and shadow the tight variant on future unseen cards.

Visual audit: `assets/optimizer_visual_audit.png`

## Architectures tried

- Floor threshold: range ≤ max(absolute points, ATR×multiple), including the current baseline.
- Cap threshold: range ≤ min(absolute points, ATR×multiple).
- ATR-only and absolute-only compression.
- Causal rolling-percentile compression.
- High/low range versus close-range detection.
- Break buffers, cooldowns, retest windows, close-hold tolerance, and optional directional candle confirmation.

Stage 1: `/Users/kevinhe/.hermes/workspace/openclaw-main/strategy-lab/dragon_entry_game/reports/execution_box_optimizer_2026-07-12/stage1_architectures.csv`
Stage 2: `/Users/kevinhe/.hermes/workspace/openclaw-main/strategy-lab/dragon_entry_game/reports/execution_box_optimizer_2026-07-12/stage2_refinements.csv`
Events: `/Users/kevinhe/.hermes/workspace/openclaw-main/strategy-lab/dragon_entry_game/reports/execution_box_optimizer_2026-07-12/finalist_events.csv`
