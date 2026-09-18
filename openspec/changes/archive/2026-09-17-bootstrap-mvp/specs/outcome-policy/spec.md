## ADDED Requirements

### Requirement: Provisional default thresholds

The library SHALL export `DEFAULT_THRESHOLDS = { pass: 0.8, fail: 0.5 }` and use it when no other
level sets a value. These values are provisional until `evaluation-harness` calibrates them.

#### Scenario: Exported constant

- **WHEN** `DEFAULT_THRESHOLDS` is imported from `edcheck`
- **THEN** it deep-equals `{ pass: 0.8, fail: 0.5 }` and is frozen

#### Scenario: Defaults apply when nothing overrides

- **GIVEN** an instance, schema and rule with no thresholds
- **WHEN** a rule fails with `noul: 0.1`
- **THEN** the issue has `thresholds: { pass: 0.8, fail: 0.5 }`

### Requirement: Probability to outcome mapping

For Noul rules the outcome SHALL be `pass` when `p ≥ pass`, `warning` when `fail ≤ p < pass` and
`fail` when `p < fail`. A `pass` outcome MUST NOT emit an issue.

#### Scenario: Clear pass

- **WHEN** the answer is `0.95` with default thresholds
- **THEN** no issue is emitted for that rule

#### Scenario: Exactly at pass threshold

- **WHEN** the answer is `0.8`
- **THEN** the outcome is `pass` and no issue is emitted

#### Scenario: Just below pass threshold

- **WHEN** the answer is `0.79`
- **THEN** the issue has `outcome: "warning"` and `probability: 0.79`

#### Scenario: Exactly at fail threshold

- **WHEN** the answer is `0.5`
- **THEN** the issue has `outcome: "warning"`

#### Scenario: Just below fail threshold

- **WHEN** the answer is `0.49`
- **THEN** the issue has `outcome: "fail"`

#### Scenario: Extremes

- **WHEN** the answer is `0` and, in a second parse, `1`
- **THEN** `0` yields `outcome: "fail"` and `1` yields no issue

#### Scenario: Collapsed band

- **GIVEN** thresholds `{ pass: 0.7, fail: 0.7 }`
- **WHEN** the answer is `0.7` and, in a second parse, `0.69`
- **THEN** `0.7` passes and `0.69` is `fail`; no answer can produce `warning`

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
- **THEN** the issue has `outcome: "warning"` and `thresholds: { pass: 0.95, fail: 0.5 }`

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
