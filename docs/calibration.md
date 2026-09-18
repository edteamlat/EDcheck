# Threshold calibration

EDcheck maps a Noul probability `p` to `pass | warning | fail` with
`DEFAULT_THRESHOLDS`. Those values are derived from committed observations in
`test/eval/baseline.json`, not chosen by hand.

## Method

`test/helpers/calibration/derive-thresholds.ts` is the normative algorithm:

1. Take every Noul observation with `expect` `positive` or `negative` and a
   probability.
2. `negativeMax` is the highest negative `p`. `positiveMin` is the lowest
   positive `p`.
3. If `positiveMin <= negativeMax` the labels overlap. The function reports the
   overlapping fixture ids and refuses to emit thresholds. Relabel or replace
   those fixtures and re-run.
4. Otherwise both thresholds sit inside the gap on a `0.05` grid with a `0.05`
   margin:
   - `fail = ceilToGrid(negativeMax + 0.05)` so every baseline negative is a
     decisive fail
   - `pass = floorToGrid(positiveMin - 0.05)` so every baseline positive is a
     decisive pass
5. If that pair is inverted (`narrowGap`), both thresholds collapse to the
   midpoint of the gap, one grid step apart.
6. Both values are clamped to `[0.05, 0.95]` and rounded to two decimals.

Safety invariants hold by construction: every baseline negative has `p < pass`
and every baseline positive has `p >= fail`. The warning band is the uncovered
part of the gap — where unseen values should land.

## Current values

`DEFAULT_THRESHOLDS` is `{ pass: 0.7, fail: 0.7 }`.

The warning band is collapsed: `p ≥ 0.7` is a pass and `p < 0.7` is a fail.
That pair equals `baseline.calibration.pass` / `fail` after
`ceilToGrid(0.64 + 0.05)` and `floorToGrid(0.77 - 0.05)` met on the same grid
step. Override thresholds on the instance, schema or rule to restore a warning
range.

## Provenance

- `recordedAt`: `2026-09-18T03:42:43.213Z`
- `provider`: `typesafe`
- `model`: `jev-1.13.0`

## Recalibration

1. Author or edit fixtures under `test/fixtures/<rule>/{es,en}.json`.
2. Run `EDCHECK_WRITE_BASELINE=1 yarn eval` with `TYPESAFE_API_KEY` or
   `AI_GATEWAY_API_KEY`.
3. Inspect the diff of `test/eval/baseline.json`. If `separable` is `false`,
   relabel the listed fixtures and repeat.
4. Set `DEFAULT_THRESHOLDS` in `src/policy/default-thresholds.ts` to the
   derived `pass` / `fail`.
5. Update this file's current values and provenance (`recordedAt`, `model`).
6. `yarn verify` and `yarn eval` must stay green (at most one miss per rule
   and language).

## Adding a fixture rule

1. Add `test/fixtures/<rule>/{es,en}.json` in the D1 format (coverage minimums
   and required tags are asserted by `test/fixtures/fixtures.test.ts`).
2. Add `test/fixtures/<rule>/binding.ts` and register it in
   `test/fixtures/registry.ts`.
3. Re-run the recalibration loop so the new observations enter the baseline.
