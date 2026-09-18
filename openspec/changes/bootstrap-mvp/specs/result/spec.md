## ADDED Requirements

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
