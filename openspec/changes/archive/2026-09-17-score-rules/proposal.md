## Why

Noul answers yes/no. Quality is a spectrum: a project description can be meaningless, vague or
clear, and the app wants to warn on "vague" and block on "meaningless". Constitution §4.3 locks
Score as the opt-in primitive for that, and §5.4 fixes the outcome model: resulting level → outcome
declared on the rule, low `confidence` → warning. This change adds `kind: "score"` end to end on
top of the bootstrap pipeline, keeping Noul and Score rules of one object in one request.

## What Changes

- `semantic({ kind: "score", intent, levels, minConfidence?, severity?, message?, id? })` builds a
  Score rule. `levels` is an ordered list of at least two
  `{ label, description?, outcome: "pass" | "warning" | "fail" }`; `description` defaults to
  `label`. `thresholds`, `valid` and `invalid` are rejected on Score rules; `levels` and
  `minConfidence` are rejected on Noul rules. `kind` defaults to `"noul"`.
- Compilation: `{ type: "score", instructions: "Rate \`<path>\` on this scale: <intent>", criteria: [descriptions] }`.
  Score and Noul questions share the object's single request.
- Outcome: resulting level = the level with the highest probability (tie → lowest index); outcome =
  that level's declared outcome; if `confidence < minConfidence` the outcome becomes `warning`.
  `confidence === minConfidence` is not low.
- `minConfidence` precedence rule > schema > instance > `DEFAULT_MIN_CONFIDENCE` (`0.6`,
  provisional, exported).
- Provider contract: `SemanticQuestion` and `SemanticAnswer` become discriminated unions
  (`noul | score`). `mockProvider` answers Score questions from `{ probabilities, confidence? }`;
  `typesafeProvider` maps and validates Score answers. An answer whose type does not match its
  question, or with malformed probabilities/confidence, is a `malformed_response`.
- Score issues carry `score`, `confidence`, `level` (label) and `minConfidence` instead of
  `probability` and `thresholds`.
- New `EDcheckConfigError` code: `invalid_confidence`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `semantic-rules`: adds the `kind` discriminator and Score rule options with their validation.
- `compilation`: adds the Score question template and the mixed-kind request requirement.
- `outcome-policy`: adds the default minimum confidence, Score outcome mapping and Score answer
  validation.
- `provider`: adds Score questions/answers to the contract, the mock and the TypeSafe adapter.
- `result`: adds the Score issue shape. (Not listed in the roadmap for this change; needed because
  `Issue` gains `level` and `minConfidence` — `score` and `confidence` are already in §5.5.)

All deltas are ADDED requirements; bootstrap requirements are not rewritten, so this change does
not conflict with `context-inheritance` or `cross-field-rules`.

## Impact

- **Public API — runtime symbols:** `DEFAULT_MIN_CONFIDENCE` added. The public-surface test list
  is updated.
- **Public API — types:** `SemanticRuleOptions` becomes `NoulRuleOptions | ScoreRuleOptions`;
  `SemanticRule` becomes `NoulRule | ScoreRule`; new `ScoreLevel`, `NoulQuestion`, `ScoreQuestion`,
  `NoulAnswer`, `ScoreAnswer`, `MockAnswer`; `EDcheckOptions.minConfidence`,
  `SemanticSchemaOptions.minConfidence`; `Issue.score`, `Issue.confidence`, `Issue.level`,
  `Issue.minConfidence`. Existing Noul code compiles unchanged.
- **Modules:** `rules/` (union types, validation), `policy/` (`map-score-to-outcome`,
  `resolve-min-confidence`, `default-min-confidence`), `compiler/` (score template), `providers/`
  (union types, mock and adapter mapping), `result/` (score issue), `api/` (dispatch on `kind`,
  `minConfidence` plumbing). No new module.
- **Dependencies:** none.
- **Tests:** rule validation and behavior through `safeParse` with the mock; direct unit tests for
  `policy/` mapping; adapter tests with injected `fetch`; type tests for the discriminated union;
  fixtures `test/fixtures/project-description/{es,en}.json` with expected levels; smoke eval
  skipped without a key; new payload snapshots.
- **Interaction with `cross-field-rules` (independent):** a `crossField` binding accepts any
  `SemanticRule`; Score bindings compile with `Rate <path list> on this scale: <intent>`. The
  corresponding task group runs only when `cross-field-rules` is applied.
- **Interaction with `context-inheritance` (independent):** none beyond the shared request/group
  mechanics; Score rules group like Noul rules.
- **Not in this change:** Choice primitive (§8 out), per-level messages, calibrated
  `minConfidence` (change 8), using `score` (the weighted mean) for outcome selection.
