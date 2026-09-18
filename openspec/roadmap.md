# EDcheck — change roadmap to v1

Operational checklist of constitution §15. Normative detail lives in the constitution; this file
tracks status. Update the checkbox and the `Status` line when a change is proposed, applied or
archived. Order follows dependencies: `1 → {2, 3, 5, 6, 7}`, `2 → 4`, `{3, 5} → 8`.

Every change follows §12.1 (TDD): `specs/` scenarios become red tests before `src/` code, and the
adverse cases listed here are part of its DoD, not optional extras.

Legend: `[ ]` not started · `[~]` proposed / in progress · `[x]` archived

---

## Changes

### [~] 1. `bootstrap-mvp`

- **Status:** applied (2026-09-17) — implementation complete in `src/`. Next:
  `/opsx:archive bootstrap-mvp`
- **Kickoff:** `/opsx:propose bootstrap-mvp`
- **Delivers:** walking skeleton. One Zod object, Noul rules on primitive fields, whole-object
  semantic parse, `SemanticProvider` contract + `mock` and `typesafe` adapters, provisional
  thresholds, `Issue` / `SemanticResult` with Zod passthrough, shape-failure exclusion,
  `AbortSignal` + timeout, `open` / `closed` policy, server-only guard.
- **Closes §13:** 1 (rule attachment), 2 (provider dependency), 3 (public API names),
  6 (array handling: in v1 or explicit error).
- **Specs created:** `semantic-rules`, `schema-binding`, `compilation`, `provider`,
  `outcome-policy`, `result`.
- **Harnesses born here:** public-surface symbol list test, compiled-payload snapshots,
  `test/types/` type-test for `z.infer`.
- **Adverse cases (DoD):** adversarial value only in `state`; shape failure on one node excludes
  only that node and still makes exactly one provider call; abort in flight → no result, no
  unhandled rejection; provider down under `open` and `closed`; Zod issues pass through unchanged;
  empty / whitespace / ≥ 50k chars / emoji / RTL strings; browser environment → explicit error.
- **Depends on:** —

### [~] 2. `context-inheritance`

- **Status:** applied (2026-09-17) — implementation complete in `src/`. Next:
  `/opsx:archive context-inheritance` after `bootstrap-mvp` is archived.
- **Kickoff:** `/opsx:propose context-inheritance`
- **Delivers:** string or object context, `notes[]`, precedence instance → schema → node → rule,
  reserved keys, per-rule state minimization (send only what the rule needs).
- **Closes §13:** —
- **Specs created:** `context`. **Modifies:** `compilation`.
- **Adverse cases (DoD):** conflicts across three levels resolve deterministically; a string
  context never overrides structured keys; `notes` accumulate instead of replacing; a rule with no
  context inherits everything above it; payload snapshot shows only the fields the rule declared.
- **Depends on:** 1
- **Note:** may be folded into `bootstrap-mvp` if change 1's design shows the compiler cannot
  build `state` without it. That is a legitimate edit of this file and constitution §15.

### [~] 3. `cross-field-rules`

- **Status:** applied (2026-09-17) — implementation complete in `src/`. Next:
  `/opsx:archive cross-field-rules` after `bootstrap-mvp` is archived.
- **Kickoff:** `/opsx:propose cross-field-rules`
- **Delivers:** rules attached to the containing object with declared `paths`, state restricted
  to those paths, issues attributed to every declared path, backtick field references in
  statements.
- **Closes §13:** —
- **Specs created:** `cross-field-rules`. **Modifies:** `compilation`, `result`.
- **Adverse cases (DoD):** a declared path with a shape failure disables the rule; nested paths
  with array indices attribute correctly; a path that does not exist in the schema is a typed
  error at attach time; the compiled state contains only the declared paths.
- **Depends on:** 1

### [~] 4. `node-validation`

- **Status:** applied (2026-09-17) — implementation complete in `src/`. Next:
  `/opsx:archive node-validation` after `bootstrap-mvp` is archived.
- **Kickoff:** `/opsx:propose node-validation`
- **Delivers:** single-field validation (`on blur` style use case) preserving the node's inherited
  context; same result shape as whole-object validation.
- **Closes §13:** 5 (node-level validation).
- **Specs created:** `node-validation`.
- **Adverse cases (DoD):** race — two overlapping validations of the same node, the stale one is
  never emitted; node with a cross-field rule → the rule is skipped or requires the sibling
  values explicitly (decided in design); abort in flight.
- **Depends on:** 2

### [~] 5. `score-rules`

- **Status:** applied (2026-09-17) — implementation complete in `src/`. Next:
  `/opsx:archive score-rules` after `bootstrap-mvp` is archived.
- **Kickoff:** `/opsx:propose score-rules`
- **Delivers:** `kind: "score"` rules with ordered `levels`, level → outcome mapping, low
  `confidence` → warning.
- **Closes §13:** —
- **Specs modified:** `semantic-rules`, `compilation`, `outcome-policy`.
- **Adverse cases (DoD):** fewer than two levels is a typed error; a level name that is not in
  the mapping; confidence exactly at the threshold; Noul and Score rules on the same object share
  one provider request.
- **Depends on:** 1

### [~] 6. `gateway-provider`

- **Status:** applied (2026-09-17) — implementation complete in `src/`. Next:
  `/opsx:archive gateway-provider` after `bootstrap-mvp` is archived.
- **Kickoff:** `/opsx:propose gateway-provider`
- **Delivers:** Vercel AI Gateway adapter for `typesafe-ai/jev`; normalization of `boolean` →
  noul and `providerMetadata` → confidence; key detection (`TYPESAFE_API_KEY` vs
  `AI_GATEWAY_API_KEY`).
- **Closes §13:** —
- **Specs modified:** `provider`.
- **Adverse cases (DoD):** a TypeSafe-direct user never pulls in `ai` (package-contract test);
  both keys present → explicit precedence; gateway timeout and malformed response map to the same
  `open` / `closed` behavior as the direct adapter.
- **Depends on:** 1

### [~] 7. `observability-hooks`

- **Status:** applied (2026-09-17) — implementation complete in `src/`. Next:
  `/opsx:archive observability-hooks` after `bootstrap-mvp` is archived.
- **Kickoff:** `/opsx:propose observability-hooks`
- **Delivers:** `onRequest` / `onResponse` / `onError` callbacks with duration, model, usage
  (tokens, request count) and outcomes.
- **Closes §13:** —
- **Specs created:** `observability`.
- **Adverse cases (DoD):** a throwing hook never breaks validation; hooks fire exactly once per
  provider request; no output on stdout/stderr by default; aborted requests fire `onError` with a
  typed cancellation error.
- **Depends on:** 1

### [~] 8. `evaluation-harness`

- **Status:** applied (2026-09-17) — fixture format, registry, runner and derivation are in
  `test/`. `DEFAULT_THRESHOLDS` stays `{ pass: 0.8, fail: 0.5 }` until
  `EDCHECK_WRITE_BASELINE=1 yarn eval` writes `test/eval/baseline.json`. Next:
  `/opsx:archive evaluation-harness` after a real baseline is committed.
- **Kickoff:** `/opsx:propose evaluation-harness`
- **Delivers:** `es` / `en` fixtures for the PDR example rules (positive, negative, ambiguous),
  `test/eval/` against real Jev with tolerance bands, calibrated default thresholds.
- **Closes §13:** 4 (default thresholds).
- **Specs created:** `evaluation`. **Modifies:** `outcome-policy`.
- **Adverse cases (DoD):** eval suite is skipped, not failed, without a key; a band miss reports
  the fixture and observed probability; fixtures include adversarial and RTL cases in both
  languages.
- **Depends on:** 3, 5

### [ ] 9. `array-rules` (optional)

- **Status:** deferred — change 1 `design.md` D4 decided arrays are out of v1: a rule on or
  through a `z.array` is an `EDcheckConfigError` at `define` time; Zod issues on array items still
  pass through. Reopen only with eval data justifying an item cap.
- **Kickoff:** `/opsx:propose array-rules`
- **Delivers:** per-item rules, default item cap, fan-out declaration.
- **Only if** eval data later justifies an item cap. Change 1 `design.md` D4 already decided
  arrays out of v1 (`EDcheckConfigError` at `define` time).
- **Depends on:** 1, 3

---

## Not changes (plain `chore:` commits)

- [ ] CI workflow running `yarn verify`
- [ ] `CHANGELOG.md`
- [ ] npm publish configuration and `0.1.0` release
