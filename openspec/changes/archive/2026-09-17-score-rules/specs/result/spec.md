## ADDED Requirements

### Requirement: Score issue shape

An issue emitted by a Score rule SHALL carry `path`, `code: "semantic"`, `severity`, `outcome`,
`message`, `ruleId`, `score`, `confidence`, `level` (the winning level's label), `minConfidence`
and `provider.model`. It SHALL NOT carry `probability` or `thresholds`.

#### Scenario: Score fail issue is fully populated

- **GIVEN** levels `[meaningless: fail, vague: warning, clear: pass]`, `mockProvider({ answers: { description: { probabilities: [0.8, 0.1, 0.1], confidence: 0.9 } }, model: "mock" })`
- **WHEN** parsed
- **THEN** the issue deep-equals `{ path: ["description"], code: "semantic", severity: "error", outcome: "fail", message: 'Semantic rule "description" failed', ruleId: "description", score: 0.3, confidence: 0.9, level: "meaningless", minConfidence: 0.6, provider: { model: "mock" } }` (score within `1e-9`)

#### Scenario: No noul fields on a score issue

- **WHEN** a Score rule yields an issue
- **THEN** `"probability" in issue` and `"thresholds" in issue` are both `false`

#### Scenario: No score fields on a noul issue

- **WHEN** a Noul rule yields an issue
- **THEN** `"score" in issue`, `"confidence" in issue`, `"level" in issue` and `"minConfidence" in issue` are all `false`

#### Scenario: Warning message for uncertain level

- **WHEN** a Score rule yields `warning` because of low confidence
- **THEN** `issue.message` is `Semantic rule "<ruleId>" is uncertain`

#### Scenario: Unavailable issue for a score rule

- **GIVEN** a failing provider and a Score rule
- **WHEN** parsed under `open`
- **THEN** the `semantic_unavailable` issue has no `score`, `confidence`, `level` or `minConfidence`

#### Scenario: Issue types are exported

- **WHEN** `Issue["level"]` and `Issue["minConfidence"]` are type-checked
- **THEN** they are `string | undefined` and `number | undefined` (type test)
