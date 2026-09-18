Every task ends with `yarn verify` green. Red tasks write failing tests for the listed spec
scenarios and stop; green tasks make them pass with the minimum code that respects `design.md`.
Requires `bootstrap-mvp`, `cross-field-rules` and `score-rules` applied. Group 4 (`project-name`)
runs only when `context-inheritance` is applied; the Gateway route in group 5 only when
`gateway-provider` is applied. Scenario names refer to `specs/evaluation/spec.md` unless prefixed
with `outcome-policy`. Everything in this change is test code, fixtures and docs; the only `src/`
edit is the value of `DEFAULT_THRESHOLDS` in group 7. Group 7.2 needs a real API key once.

## 1. Fixture schema and loader

- [x] 1.1 Red — `test/helpers/fixtures/fixture-file-schema.test.ts` with synthetic files:
      valid Noul, valid Score, "Expect matches the kind" (both directions), duplicate ids,
      malformed id, missing `language`, `value` of unsupported type (`null`). `loadFixture`
      error message contains the path and the offending `id`.
- [x] 1.2 Green — `test/helpers/fixtures/{fixture-file-schema,load-fixture}.ts`,
      `types/{fixture-case,fixture-file,fixture-expect,fixture-binding}.ts`.

## 2. Fixture corpus and coverage test

- [x] 2.1 Red — `test/fixtures/fixtures.test.ts` with `Fixture format and coverage` scenarios:
      "Every fixture file validates", "Ids are unique and well-formed", "Noul coverage minimums",
      "Score coverage minimums", "Required tags per language", "Long and emoji cases per rule",
      "Injection cases are negative", "Migrated content preserved". It iterates
      `test/fixtures/*/` with `readdirSync`, so new rules are covered automatically.
- [x] 2.2 Green — migrate `full-name`, `age-occupation`, `project-description` to the D1
      format preserving content; write `bio-consistency/{es,en}.json`. Each Noul file ≥ 6/6/2,
      Score ≥ 2 per level + 2 ambiguous; tags `adversarial` ×2, `injection`, `rtl` per file;
      `long` (≥ 2 000 chars) and `emoji` per rule. Author cases as a native speaker would:
      Spanish files use Spanish names, occupations and descriptions; RTL cases use Arabic or
      Hebrew values in both files. Delete the old per-rule eval files
      (`full-name`, `age-occupation`, `project-description`).

## 3. Registry and payload snapshots

- [x] 3.1 Red — `test/api/fixture-payloads.test.ts` with `Fixture registry and payload
snapshots` scenarios: "Registry covers every fixture directory", "Binding parses its own
      positive cases through Zod", "Payload snapshot per binding and language", "Cross-field
      binding state". Bootstrap's `full-name` snapshot test is replaced by this file with
      identical snapshot content.
- [x] 3.2 Green — `test/fixtures/{full-name,age-occupation,bio-consistency,project-description}/binding.ts`
      and `test/fixtures/registry.ts`. Snapshots under `test/api/__snapshots__/fixture-payloads/`.

## 4. Context binding (only when `context-inheritance` is applied)

- [x] 4.1 Red — extend `fixtures.test.ts` coverage (automatic) and `fixture-payloads.test.ts`
      with "Context binding state".
- [x] 4.2 Green — `test/fixtures/project-name/{es,en}.json` and `binding.ts` with the schema
      context from design D2; add to `registry.ts`.

## 5. Eval helpers (offline)

- [x] 5.1 Red — `test/helpers/eval/has-eval-key.test.ts` ("hasEvalKey");
      `resolve-eval-provider.test.ts` ("Provider from environment", "Forced provider");
      `format-miss.test.ts` ("Miss message format", "Long values are truncated in messages",
      "Object values are serialized", "Level miss message"); `run-cases.test.ts` ("Bounded
      concurrency", "Observation shape", "Score observation from mock", "Provider failure counts
      as a miss", "Ambiguous is recorded only", "Positive band", "Negative band", "Tolerance"
      via `countMisses`); `write-baseline.test.ts` ("Eval writes the baseline only when asked").
- [x] 5.2 Green — `test/helpers/eval/{has-eval-key,describe-eval,resolve-eval-provider,run-cases,count-misses,format-miss,write-baseline}.ts`,
      `types/{observation,miss}.ts`. `resolve-eval-provider` uses `providerFromEnv` when
      exported by `edcheck`, else `typesafeProvider`.

## 6. Derivation (offline)

- [x] 6.1 Red — `test/helpers/calibration/derive-thresholds.test.ts` with `Baseline and
threshold derivation` scenarios: "Separable observations", "Safety invariants hold on the
      input" (property-style over 50 random separable inputs), "Narrow gap", "Overlap is
      reported, not resolved", "Grid rounding avoids float drift", "Clamping", "Rates are
      computed", "Missing label throws".
- [x] 6.2 Green — `test/helpers/calibration/derive-thresholds.ts`, `types/calibration.ts`.

## 7. Eval suites, baseline and the calibrated constant

- [x] 7.1 Red — `test/eval/noul-rules.eval.test.ts` ("One test per rule and language" is
      asserted by a collection test that imports the file's declared names) and
      `test/eval/score-rules.eval.test.ts`, both under `describeEval`. `test/eval-skip.test.ts`
      ("Skipped without a key"). `test/policy/default-thresholds-calibration.test.ts` ("Constant
      matches the committed baseline", "Baseline provenance") — red until a baseline exists.
      Update bootstrap boundary tests per design D5 (`outcome-policy` "Probability to outcome
      mapping" scenarios pin `{ pass: 0.8, fail: 0.5 }`; `result` "Fail issue is fully populated"
      pins the same on its instance) and add "Default band boundaries" and the modified
      "Exported constant" / "Defaults apply when nothing overrides".
- [x] 7.2 Green — implement the two eval suites; add `"eval"` script to `package.json`. Run
      `EDCHECK_WRITE_BASELINE=1 yarn eval` once with a real key; commit
      `test/eval/baseline.json`. If `separable` is `false`, revise the listed fixtures (relabel
      as ambiguous or replace), re-run, repeat. Set `DEFAULT_THRESHOLDS` in
      `src/policy/default-thresholds.ts` to `baseline.calibration` values. `yarn verify` green;
      `yarn eval` green with ≤ 1 miss per rule × language.

## 8. Docs and roadmap

- [x] 8.1 Red — `outcome-policy` "Provenance is documented": a test reads `docs/calibration.md`
      and asserts it contains the current `pass`/`fail` values, `baseline.recordedAt` and
      `baseline.model`.
- [x] 8.2 Green — `docs/calibration.md` (method, current values, provenance, recalibration
      loop, how to add a fixture rule); README thresholds section updated with provenance and
      `yarn eval`; constitution §13.4 marked closed by this change. Mark `evaluation-harness`
      archived in `openspec/roadmap.md` on archive.
