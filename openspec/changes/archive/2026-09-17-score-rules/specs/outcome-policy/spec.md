## ADDED Requirements

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
