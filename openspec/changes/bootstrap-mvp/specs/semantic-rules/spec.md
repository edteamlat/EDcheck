## ADDED Requirements

### Requirement: Basic statement rule

`semantic(statement)` SHALL return a Noul rule whose `intent` is the statement, with no criteria,
`severity: "error"`, no thresholds, no message and no explicit id. The statement is text written by
the schema author; it never contains a user value.

#### Scenario: Statement becomes a Noul rule with defaults

- **WHEN** `semantic("A plausible full name for a real person")` is called
- **THEN** the returned rule has `kind: "noul"`, `intent` equal to the statement, `severity: "error"`,
  and `valid`, `invalid`, `thresholds`, `message` and `id` are `undefined`

#### Scenario: Empty statement is rejected

- **WHEN** `semantic("")` or `semantic("   \n")` is called
- **THEN** it throws `EDcheckConfigError` with `code: "invalid_rule"` and no rule is produced

### Requirement: Advanced rule options

`semantic(options)` SHALL accept `intent` (required), `valid`, `invalid`, `thresholds`
(`{ pass?, fail? }`), `severity` (`"error" | "warning" | "info"`), `message` and `id`, and SHALL
validate them at call time.

#### Scenario: All options are preserved

- **WHEN** `semantic({ intent, valid, invalid, thresholds: { pass: 0.9, fail: 0.3 }, severity: "warning", message: "Custom", id: "bio_meaningful" })` is called
- **THEN** every field is present on the rule with the same value and `kind` is `"noul"`

#### Scenario: Criteria may be partial

- **WHEN** `semantic({ intent: "…", valid: "Looks like a real name" })` is called without `invalid`
- **THEN** the rule has `valid` set and `invalid` undefined, and no error is thrown

#### Scenario: Empty intent is rejected

- **WHEN** `semantic({ intent: "  " })` is called
- **THEN** it throws `EDcheckConfigError` with `code: "invalid_rule"`

#### Scenario: Rule thresholds are validated in isolation

- **WHEN** `semantic({ intent: "…", thresholds: { pass: 0.4, fail: 0.6 } })` or a threshold outside `[0, 1]` is passed
- **THEN** it throws `EDcheckConfigError` with `code: "invalid_thresholds"`

#### Scenario: Partial rule thresholds are accepted

- **WHEN** `semantic({ intent: "…", thresholds: { pass: 0.95 } })` is called
- **THEN** the rule keeps `thresholds: { pass: 0.95 }` and `fail` is resolved later by precedence

#### Scenario: Unknown severity is rejected at runtime

- **WHEN** a JavaScript caller passes `severity: "fatal"`
- **THEN** it throws `EDcheckConfigError` with `code: "invalid_option"`

#### Scenario: Empty explicit id is rejected

- **WHEN** `semantic({ intent: "…", id: "" })` is called
- **THEN** it throws `EDcheckConfigError` with `code: "invalid_rule"`

### Requirement: Rules are immutable plain data

A `SemanticRule` SHALL be a frozen plain object with no methods and no reference to a provider,
schema or instance, so one rule can be attached to several schemas.

#### Scenario: Returned rule is frozen

- **WHEN** a rule is created with `semantic("…")`
- **THEN** `Object.isFrozen(rule)` is `true` and assigning `rule.intent = "x"` in strict mode throws

#### Scenario: The same rule can be bound twice

- **WHEN** one rule instance is used in `define` for two different Zod objects
- **THEN** both `define` calls succeed and each compiled request references its own path
