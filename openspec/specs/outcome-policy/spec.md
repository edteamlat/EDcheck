## Purpose

Map Jev Noul probabilities and Score levels to pass, warning, or fail using calibrated default thresholds and minimum confidence, resolve issue severity, and apply the open/closed failure policy when the provider is unavailable.

## Requirements

### Requirement: Provisional default thresholds

The library SHALL export a frozen `DEFAULT_THRESHOLDS` whose values equal the calibration recorded in
`test/eval/baseline.json` (derived from real Jev observations over the fixture corpus), and SHALL
use it when no other level sets a value.

#### Scenario: Exported constant

- **WHEN** `DEFAULT_THRESHOLDS` is imported from `edcheck`
- **THEN** it is frozen, `0 < fail <= pass < 1`, and it deep-equals `{ pass: baseline.calibration.pass, fail: baseline.calibration.fail }`

#### Scenario: Defaults apply when nothing overrides

- **GIVEN** an instance, schema and rule with no thresholds
- **WHEN** a rule fails with a probability below `DEFAULT_THRESHOLDS.fail`
- **THEN** the issue has `thresholds` deep-equal to `DEFAULT_THRESHOLDS`

#### Scenario: Provenance is documented

- **WHEN** `docs/calibration.md` is read
- **THEN** it states the current values, the `recordedAt` date and `model` of the baseline, and the recalibration command

### Requirement: Probability to outcome mapping

For Noul rules the outcome SHALL be `pass` when `p ≥ pass`, `warning` when `fail ≤ p < pass` and
`fail` when `p < fail`. A `pass` outcome MUST NOT emit an issue. Boundary scenarios pin
`thresholds: { pass: 0.8, fail: 0.5 }` on the instance so they do not depend on the calibrated
default.

#### Scenario: Clear pass

- **GIVEN** instance thresholds `{ pass: 0.8, fail: 0.5 }`
- **WHEN** the answer is `0.95`
- **THEN** no issue is emitted for that rule

#### Scenario: Exactly at pass threshold

- **GIVEN** instance thresholds `{ pass: 0.8, fail: 0.5 }`
- **WHEN** the answer is `0.8`
- **THEN** the outcome is `pass` and no issue is emitted

#### Scenario: Just below pass threshold

- **GIVEN** instance thresholds `{ pass: 0.8, fail: 0.5 }`
- **WHEN** the answer is `0.79`
- **THEN** the issue has `outcome: "warning"` and `probability: 0.79`

#### Scenario: Exactly at fail threshold

- **GIVEN** instance thresholds `{ pass: 0.8, fail: 0.5 }`
- **WHEN** the answer is `0.5`
- **THEN** the issue has `outcome: "warning"`

#### Scenario: Just below fail threshold

- **GIVEN** instance thresholds `{ pass: 0.8, fail: 0.5 }`
- **WHEN** the answer is `0.49`
- **THEN** the issue has `outcome: "fail"`

#### Scenario: Extremes

- **GIVEN** instance thresholds `{ pass: 0.8, fail: 0.5 }`
- **WHEN** the answer is `0` and, in a second parse, `1`
- **THEN** `0` yields `outcome: "fail"` and `1` yields no issue

#### Scenario: Collapsed band

- **GIVEN** thresholds `{ pass: 0.7, fail: 0.7 }`
- **WHEN** the answer is `0.7` and, in a second parse, `0.69`
- **THEN** `0.7` passes and `0.69` is `fail`; no answer can produce `warning`

#### Scenario: Default band boundaries

- **GIVEN** no thresholds at any level
- **WHEN** the answers are `DEFAULT_THRESHOLDS.pass`, `DEFAULT_THRESHOLDS.pass - 0.01`, `DEFAULT_THRESHOLDS.fail` and `DEFAULT_THRESHOLDS.fail - 0.01`
- **THEN** the outcomes are `pass`, `warning`, `warning` and `fail` when `pass > fail`, or `pass`, `fail`, `pass` and `fail` when the default band is collapsed (`pass === fail`)

### Requirement: Threshold precedence

Effective thresholds SHALL be `{ ...DEFAULT_THRESHOLDS, ...instance, ...schema, ...rule }`, each
level partial, and SHALL be reported on every semantic issue.

#### Scenario: Rule overrides schema overrides instance

- **GIVEN** instance `{ pass: 0.6, fail: 0.2 }`, schema `{ pass: 0.7 }`, rule `{ fail: 0.3 }`
- **WHEN** a rule fails with `noul: 0.1`
- **THEN** the issue has `thresholds: { pass: 0.7, fail: 0.3 }`

#### Scenario: Sibling rules keep independent thresholds

- **GIVEN** rule A with `{ pass: 0.95 }` and rule B without thresholds on the same schema
- **WHEN** both answers are `0.9`
- **THEN** A yields `warning` and B yields no issue

#### Scenario: Instance-only override

- **GIVEN** instance `{ pass: 0.95 }` and no schema or rule thresholds
- **WHEN** the answer is `0.9`
- **THEN** the issue has `outcome: "warning"` and `thresholds: { pass: 0.95, fail: DEFAULT_THRESHOLDS.fail }`

### Requirement: Severity resolution

A `fail` outcome SHALL use the rule's `severity` (default `error`). A `warning` outcome SHALL use
the less severe of the rule's `severity` and `warning`. Order: `error > warning > info`.

#### Scenario: Fail with default severity blocks

- **WHEN** a rule without `severity` yields `fail`
- **THEN** the issue has `severity: "error"` and `result.success` is `false`

#### Scenario: Fail with warning severity does not block

- **WHEN** `semantic({ intent, severity: "warning" })` yields `fail`
- **THEN** the issue has `severity: "warning"`, `outcome: "fail"` and `result.success` is `true`

#### Scenario: Warning outcome on an error rule

- **WHEN** a rule with default severity yields `warning`
- **THEN** the issue has `severity: "warning"` and `result.success` is `true`

#### Scenario: Warning outcome on an info rule

- **WHEN** `semantic({ intent, severity: "info" })` yields `warning`
- **THEN** the issue has `severity: "info"`

#### Scenario: Fail on an info rule

- **WHEN** `semantic({ intent, severity: "info" })` yields `fail`
- **THEN** the issue has `severity: "info"` and `result.success` is `true`

### Requirement: Failure policy

The parse SHALL emit one `semantic_unavailable` issue per surviving rule when the provider fails
(thrown `EDcheckProviderError`, timeout or malformed response). Under `open` (default) its severity
is `warning` and `success` is unchanged; under `closed` it is `error`. Precedence: schema > instance

> default.

#### Scenario: Open policy keeps success

- **GIVEN** `mockProvider({ error: new EDcheckProviderError("http", { status: 503 }) })` and two rules
- **WHEN** valid data is parsed
- **THEN** `result.success` is `true`, `result.data` is present, and `result.issues` has exactly two issues with `code: "semantic_unavailable"`, `severity: "warning"`, the rule `path` and `ruleId`, and no `probability`

#### Scenario: Closed policy fails

- **GIVEN** the same provider and `createEDcheck({ provider, policy: "closed" })`
- **WHEN** valid data is parsed
- **THEN** both issues have `severity: "error"` and `result.success` is `false` while `result.data` is still present

#### Scenario: Schema-level policy overrides instance

- **GIVEN** instance `policy: "closed"` and `define(schema, { rules, policy: "open" })`
- **WHEN** the provider fails
- **THEN** the issues have `severity: "warning"` and `result.success` is `true`

#### Scenario: Zod issues coexist with unavailable issues

- **GIVEN** a failing provider and data with one shape failure on a non-rule field
- **WHEN** parsed
- **THEN** `result.issues` contains the Zod issue first, then the `semantic_unavailable` issues, and `result.success` is `false` because of the Zod issue

#### Scenario: Missing answer marks the whole request unavailable

- **GIVEN** a custom provider that omits the answer for one of two question ids
- **WHEN** parsed
- **THEN** both rules receive `semantic_unavailable` and no rule receives a probability-based issue

#### Scenario: Unavailable issue does not leak provider internals

- **WHEN** the provider fails with a message containing the API key
- **THEN** no `result.issues[].message` contains the key; the default message is `Semantic validation unavailable for rule "<ruleId>"`

#### Scenario: Non-provider errors are not swallowed

- **GIVEN** a custom provider that throws `new Error("bug")`
- **WHEN** parsed
- **THEN** `safeParse` rejects with that error; the failure policy applies only to `EDcheckProviderError`

### Requirement: Default minimum confidence

The library SHALL export `DEFAULT_MIN_CONFIDENCE = 0.6` (provisional) and resolve the effective
minimum confidence of a Score rule as rule > schema > instance > default. Each level SHALL be
validated in `[0, 1]` with `EDcheckConfigError` code `invalid_confidence`.

#### Scenario: Exported constant

- **WHEN** `DEFAULT_MIN_CONFIDENCE` is imported from `edcheck`
- **THEN** it equals `0.6`

#### Scenario: Default applies when nothing overrides

- **WHEN** a Score rule yields an issue and no level sets `minConfidence`
- **THEN** `issue.minConfidence` is `0.6`

#### Scenario: Rule overrides schema overrides instance

- **GIVEN** `createEDcheck({ provider, minConfidence: 0.3 })`, `define(schema, { rules, minConfidence: 0.5 })` and a rule with `minConfidence: 0.9`
- **WHEN** the rule yields an issue
- **THEN** `issue.minConfidence` is `0.9`; without the rule value it is `0.5`; without schema and rule values it is `0.3`

#### Scenario: Invalid instance or schema value

- **WHEN** `createEDcheck({ provider, minConfidence: 2 })` and, separately, `define(schema, { rules, minConfidence: -1 })` are called
- **THEN** each throws `EDcheckConfigError` with `code: "invalid_confidence"`

#### Scenario: minConfidence does not affect noul rules

- **GIVEN** an instance with `minConfidence: 1` and a Noul rule answering `0.95`
- **WHEN** parsed
- **THEN** no issue is emitted

### Requirement: Score outcome mapping

For a Score rule the resulting level SHALL be the index with the highest probability (ties → the
lowest index). The outcome SHALL be that level's declared outcome, replaced by `warning` when
`confidence < minConfidence`. `pass` emits no issue.

#### Scenario: Highest probability picks the level

- **GIVEN** levels `[fail, warning, pass]` and `mockProvider({ answers: { d: { probabilities: [0.1, 0.2, 0.7], confidence: 0.9 } } })`
- **WHEN** parsed
- **THEN** no issue is emitted

#### Scenario: Middle level yields warning

- **WHEN** probabilities are `[0.2, 0.6, 0.2]` with confidence `0.9`
- **THEN** the issue has `outcome: "warning"`, `level: "vague"`, `severity: "warning"`

#### Scenario: First level yields fail

- **WHEN** probabilities are `[0.8, 0.1, 0.1]` with confidence `0.9`
- **THEN** the issue has `outcome: "fail"`, `level: "meaningless"`, `severity: "error"` and `result.success` is `false`

#### Scenario: Tie resolves to the lowest index

- **WHEN** probabilities are `[0.5, 0.5, 0]` with confidence `0.9`
- **THEN** `issue.level` is the first level's label

#### Scenario: Bimodal distribution does not pick the middle

- **GIVEN** levels `[fail, warning, pass]`
- **WHEN** probabilities are `[0.5, 0, 0.5]` with confidence `0.9`
- **THEN** the issue has `level: "meaningless"` and `outcome: "fail"`

#### Scenario: Low confidence softens a fail

- **WHEN** probabilities are `[0.4, 0.3, 0.3]` with confidence `0.2` and `minConfidence` `0.6`
- **THEN** the issue has `outcome: "warning"`, `level: "meaningless"`, `confidence: 0.2`, `minConfidence: 0.6` and `result.success` is `true`

#### Scenario: Low confidence turns a pass into a warning

- **WHEN** probabilities are `[0.3, 0.3, 0.4]` with confidence `0.2`
- **THEN** an issue with `outcome: "warning"` and `level: "clear"` is emitted

#### Scenario: Confidence exactly at the threshold is not low

- **WHEN** probabilities are `[0.3, 0.3, 0.4]` with confidence `0.6` and `minConfidence` `0.6`
- **THEN** no issue is emitted

#### Scenario: Confidence just below the threshold is low

- **WHEN** confidence is `0.59` with `minConfidence` `0.6` and the winning level is `pass`
- **THEN** an issue with `outcome: "warning"` is emitted

#### Scenario: Gate disabled with minConfidence 0

- **WHEN** `minConfidence` is `0` and confidence is `0`
- **THEN** the mapped outcome is used unchanged

#### Scenario: Severity rules apply as for noul

- **WHEN** a Score rule with `severity: "warning"` yields `fail`, and a rule with `severity: "info"` yields `warning`
- **THEN** the issues have `severity: "warning"` and `"info"` respectively and `result.success` is `true`

#### Scenario: Custom message applies

- **WHEN** a Score rule with `message: "Describe the project"` yields `fail`
- **THEN** `issue.message` is `"Describe the project"`

### Requirement: Score answer validation

The parse SHALL treat the whole request as a provider failure (`malformed_response`, handled by
the failure policy) when an answer's `type` differs from its question, or when a Score answer's
`probabilities` length differs from the level count, contains values outside `[0, 1]`, or has a
`confidence` outside `[0, 1]`.

#### Scenario: Type mismatch

- **GIVEN** a provider returning `{ type: "noul", noul: 0.9 }` for a Score question
- **WHEN** parsed under `open`
- **THEN** every rule of the request has a `semantic_unavailable` warning

#### Scenario: Wrong probabilities length

- **GIVEN** three levels and a provider returning `probabilities: [0.5, 0.5]`
- **WHEN** parsed
- **THEN** `semantic_unavailable` is emitted for the request's rules

#### Scenario: Out-of-range values

- **GIVEN** a provider returning `probabilities: [1.5, -0.5, 0]`, and in a second test `confidence: 1.2`
- **WHEN** parsed
- **THEN** each yields `semantic_unavailable`

#### Scenario: Valid answer for a mixed request

- **GIVEN** a Noul and a Score rule and a provider answering both correctly
- **WHEN** parsed
- **THEN** each rule receives its own outcome and no `semantic_unavailable` is emitted
