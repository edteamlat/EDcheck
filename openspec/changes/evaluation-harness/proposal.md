## Why

Constitution §3.13 makes evaluation part of the product: every rule the library documents needs
positive, negative and ambiguous fixtures in `es` and `en`, and thresholds must be justified by
them. Bootstrap shipped `DEFAULT_THRESHOLDS = { pass: 0.8, fail: 0.5 }` as a guess and left §13.4
open. Earlier changes each added an ad-hoc fixture file and a one-off smoke eval with hard-coded
bands. This change replaces that with one fixture format, one registry of bound example rules, one
eval runner against real Jev, a committed baseline of observed probabilities, and a deterministic
derivation of the default thresholds from that baseline. A failing eval becomes a recalibration
signal with an actionable message, never a broken build.

## What Changes

- **Fixture format.** `test/fixtures/<rule>/{es,en}.json` become
  `{ rule, kind, language, cases: [{ id, expect, value, tags?, note? }] }` with
  `expect ∈ "positive" | "negative" | "ambiguous" | { level }`. A Zod schema validates every file
  offline; coverage minimums and required tags (`adversarial`, `injection`, `rtl`) are asserted
  per language.
- **Fixture registry.** `test/fixtures/<rule>/binding.ts` exports the Zod schema and EDcheck
  binding for each PDR example rule: `full-name`, `project-name` (context), `age-occupation`
  (cross-field), `bio-consistency` (cross-field, three paths), `project-description` (Score).
  Unit payload snapshots and the eval share these bindings.
- **Eval runner.** `test/eval/noul-rules.eval.test.ts` and `score-rules.eval.test.ts` iterate the
  registry, skip without `TYPESAFE_API_KEY`/`AI_GATEWAY_API_KEY`, choose the provider from the
  environment, run cases with bounded concurrency, and assert bands against the calibrated
  thresholds with at most one miss per rule and language. Every miss message names the rule,
  language, fixture id, truncated value, observed probability (or level) and expected band.
  `yarn eval` runs them with `.env` loaded through Node's `--env-file-if-exists`.
- **Baseline and derivation.** `test/eval/baseline.json` records the observations of a real run
  (model, provider, date). `test/helpers/calibration/derive-thresholds.ts` derives `pass`/`fail`
  from the Noul observations (grid `0.05`, margin `0.05`) and reports separability. The eval
  writes a new baseline when `EDCHECK_WRITE_BASELINE=1`. An offline test asserts that
  `DEFAULT_THRESHOLDS` equals the derivation over the committed baseline and that the baseline is
  separable.
- **`DEFAULT_THRESHOLDS`** is set to the derived values (closing §13.4). Tests that probe threshold
  boundaries pin `{ pass: 0.8, fail: 0.5 }` explicitly instead of relying on defaults.
- **Skip guarantee.** An offline test spawns `vitest run test/eval` with both keys stripped and
  asserts zero failures and at least one skipped suite.
- `docs/calibration.md` documents the method, the current values and the recalibration loop.

## Capabilities

### New Capabilities

- `evaluation`: fixture format and coverage, registry bindings and snapshots, eval runner (skip,
  provider selection, concurrency, bands, miss report), Score eval, baseline and threshold
  derivation.

### Modified Capabilities

- `outcome-policy`: "Provisional default thresholds" becomes "Calibrated default thresholds"
  (constant equals the baseline derivation); "Probability to outcome mapping" boundary scenarios
  pin explicit thresholds.

## Impact

- **Public API — runtime:** no new symbols. The value of `DEFAULT_THRESHOLDS` changes if the
  derivation says so; README documents the provenance.
- **Public API — types:** none.
- **`src/`:** only `policy/default-thresholds.ts` may change (values). Everything else lives under
  `test/` and `docs/`.
- **Tests:** new `test/fixtures/**` (JSON + bindings + schema), `test/helpers/{fixtures,eval,calibration}/`,
  `test/eval/**`, `test/fixtures/fixtures.test.ts` (format and coverage),
  `test/policy/default-thresholds-calibration.test.ts`, `test/eval-skip.test.ts` (spawn). Earlier
  per-rule eval files (`full-name`, `age-occupation`, `project-description`) are removed in
  favour of the runner; their fixtures are migrated to the new format.
- **Scripts:** `eval` (`node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run test/eval`).
  No new dependencies.
- **Depends on:** `cross-field-rules` and `score-rules` (bindings). `project-name` and its
  context require `context-inheritance`; `gateway-provider` enables the `AI_GATEWAY_API_KEY`
  route. Registry entries are conditional on the change that provides the feature.
- **Not in this change:** question-template wording experiments (the runner makes them possible;
  none are run here), per-rule threshold presets, a dashboard, CI execution of evals, fixture
  crowdsourcing, Score `minConfidence` calibration (default stays `0.6`, observations are
  recorded for a later change).
