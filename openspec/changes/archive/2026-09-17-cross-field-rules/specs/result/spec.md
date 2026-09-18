## MODIFIED Requirements

### Requirement: Semantic issue shape

A semantic issue SHALL carry `path` (array form of the dotted rule path), `code: "semantic"`,
`severity`, `outcome`, `message`, `ruleId`, `probability`, `thresholds` and `provider.model`.
Issues emitted by a cross-field rule SHALL additionally carry `paths`, the declared paths in array
form; field-rule issues SHALL NOT have a `paths` key.

#### Scenario: Fail issue is fully populated

- **GIVEN** `mockProvider({ answers: { fullName: 0.12 }, model: "mock" })`
- **WHEN** parsed
- **THEN** the issue deep-equals `{ path: ["fullName"], code: "semantic", severity: "error", outcome: "fail", message: 'Semantic rule "fullName" failed', ruleId: "fullName", probability: 0.12, thresholds: { pass: 0.8, fail: 0.5 }, provider: { model: "mock" } }`

#### Scenario: Nested path is an array

- **WHEN** a rule on `"address.street"` fails
- **THEN** `issue.path` is `["address", "street"]`

#### Scenario: Default warning message

- **WHEN** a rule yields `warning`
- **THEN** `issue.message` is `Semantic rule "<ruleId>" is uncertain`

#### Scenario: Custom message replaces both templates

- **GIVEN** `semantic({ intent, message: "Please enter your real name" })`
- **WHEN** the rule yields `warning` and, in a second parse, `fail`
- **THEN** both issues have `message: "Please enter your real name"`

#### Scenario: Pass emits nothing

- **WHEN** every answer is above `pass`
- **THEN** `result.issues` is `[]` and `result.success` is `true`

#### Scenario: Field-rule issue has no paths key

- **WHEN** a field rule fails
- **THEN** `"paths" in issue` is `false`

#### Scenario: Cross-field issue carries paths

- **WHEN** a binding on `["age", "occupation"]` fails
- **THEN** each of its issues has `paths` deep-equal to `[["age"], ["occupation"]]`

## ADDED Requirements

### Requirement: Cross-field issue attribution

A cross-field rule with a `warning` or `fail` outcome, or affected by `semantic_unavailable`, SHALL
emit one issue per declared path, in declared order, identical except for `path`. Cross-field
issues SHALL follow all field-rule issues, binding by binding.

#### Scenario: One issue per declared path

- **GIVEN** a binding on `["age", "occupation"]` with `id: "occupation_age_coherence"` and answer `0.03`
- **WHEN** parsed
- **THEN** `result.issues` has exactly two issues, with `path` `["age"]` then `["occupation"]`, both with `ruleId: "occupation_age_coherence"`, `probability: 0.03`, `outcome: "fail"`, `severity: "error"`

#### Scenario: Issues are identical except path

- **GIVEN** the same setup
- **WHEN** the two issues are compared with `path` removed
- **THEN** they deep-equal each other

#### Scenario: Nested declared paths become arrays

- **WHEN** a binding on `["address.city", "address.country"]` fails
- **THEN** the issue paths are `["address", "city"]` and `["address", "country"]`

#### Scenario: Single-path binding emits one issue

- **WHEN** a binding on `["address"]` fails
- **THEN** exactly one issue is emitted with `path: ["address"]` and `paths: [["address"]]`

#### Scenario: Warning outcome fans out too

- **WHEN** a two-path binding yields `warning`
- **THEN** two issues with `outcome: "warning"` and `severity: "warning"` are emitted and `result.success` is `true`

#### Scenario: Severity applies to every issue

- **WHEN** a two-path binding with `severity: "warning"` yields `fail`
- **THEN** both issues have `severity: "warning"` and `result.success` is `true`

#### Scenario: Custom message applies to every issue

- **WHEN** a two-path binding with `message: "Check age and occupation"` fails
- **THEN** both issues have that message

#### Scenario: Unavailable fans out per path

- **GIVEN** `mockProvider({ error: new EDcheckProviderError("http", { status: 503 }) })`, a field rule on `fullName` and a binding on `["age", "occupation"]`
- **WHEN** parsed under `open`
- **THEN** `result.issues` has three `semantic_unavailable` warnings with paths `["fullName"]`, `["age"]`, `["occupation"]`, the last two carrying `paths`

#### Scenario: Ordering with field rules

- **GIVEN** field rules `{ bio, fullName }` and bindings `[["age", "occupation"]]`, all failing
- **WHEN** parsed
- **THEN** `result.issues.map((i) => i.path.join("."))` is `["bio", "fullName", "age", "occupation"]`

#### Scenario: Success is false once regardless of fan-out

- **WHEN** only a two-path binding fails with default severity
- **THEN** `result.success` is `false` and `result.data` is present
