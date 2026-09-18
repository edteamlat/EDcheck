## Purpose

Define the public `SemanticResult`: Zod issues pass through unchanged, Noul and Score semantic issues carry their respective fields, and `success`/`data` follow shape-plus-severity rules.

## Requirements

### Requirement: Zod issues pass through unchanged

Every Zod issue SHALL appear in `result.issues` with its `code`, `path`, `message` and other
properties intact, plus `severity: "error"`, in Zod's order, before any semantic issue.

#### Scenario: Codes, paths and messages are identical

- **WHEN** data produces three Zod issues
- **THEN** `result.issues.slice(0, 3)` has the same `code`, `path` and `message` as `schema.safeParse(data).error.issues`, in the same order, each with `severity: "error"`

#### Scenario: Array index paths are preserved as numbers

- **WHEN** a Zod issue has `path: ["tags", 1]`
- **THEN** the corresponding `Issue.path` is `["tags", 1]` with `1` as a number

#### Scenario: Shape failure yields no data

- **WHEN** shape fails
- **THEN** `result.success` is `false` and `result.data` is `undefined`

#### Scenario: Zod-only schema without rules

- **GIVEN** `define(schema, { rules: {} })`
- **WHEN** invalid and then valid data are parsed
- **THEN** the results equal `{ success: false, issues: <zod issues + severity> }` and `{ success: true, data, issues: [] }` respectively

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

### Requirement: Success semantics

`success` SHALL be `false` if and only if at least one issue has `severity: "error"`. `data` SHALL
be present whenever shape passed, regardless of semantic outcome.

#### Scenario: Semantic error with shape pass keeps data

- **WHEN** shape passes and one rule fails with default severity
- **THEN** `result.success` is `false` and `result.data` deep-equals the Zod output

#### Scenario: Only warnings and infos

- **WHEN** issues are one `warning` and one `info`
- **THEN** `result.success` is `true`

#### Scenario: Mixed Zod and semantic issues share one array

- **GIVEN** rules on `fullName` and `bio`, with `bio` failing shape and `fullName` failing semantically
- **WHEN** parsed
- **THEN** `result.issues` is `[<zod issue on bio>, <semantic issue on fullName>]` in that order

#### Scenario: Semantic issues follow declaration order

- **GIVEN** rules declared `{ bio, fullName }` both failing
- **WHEN** parsed
- **THEN** `result.issues.map((i) => i.ruleId)` is `["bio", "fullName"]`

### Requirement: Type preservation

`result.data` SHALL be typed as `z.output<S> | undefined`. Rule keys SHALL be typed as dotted leaf
paths of `z.output<S>`, excluding paths through arrays.

#### Scenario: data is z.output of the schema

- **WHEN** `const r = await bound.safeParse(x)` is type-checked
- **THEN** `expectTypeOf(r.data).toEqualTypeOf<z.output<typeof User> | undefined>()` holds (type test)

#### Scenario: Unknown rule key is a type error

- **WHEN** `define(User, { rules: { nickname: semantic("…") } })` is type-checked with no `nickname` field
- **THEN** it fails to compile (`@ts-expect-error`)

#### Scenario: Nested and wrapped keys are accepted at the type level

- **WHEN** rule keys `"address.street"` and `"bio"` (optional field) are type-checked
- **THEN** they compile

#### Scenario: Array paths are rejected at the type level

- **WHEN** rule key `"tags"` for `z.array(z.string())` or `"items.name"` through an array is type-checked
- **THEN** it fails to compile (`@ts-expect-error`)

#### Scenario: Issue and SemanticResult are exported types

- **WHEN** `import type { Issue, SemanticResult } from "edcheck"` is type-checked
- **THEN** `SemanticResult<{ a: string }>["issues"]` is `Issue[]` and `SemanticResult<{ a: string }>["data"]` is `{ a: string } | undefined`

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
