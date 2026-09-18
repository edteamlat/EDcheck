## Purpose

Define author-facing `semantic()` rules: a basic statement form, advanced Noul and Score options, and immutable plain-data rules that can be reused across schemas.

## Requirements

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

### Requirement: Rule kind discriminator

`semantic(options)` SHALL accept `kind: "noul" | "score"`, defaulting to `"noul"`. Options that
belong to the other kind MUST be rejected with `EDcheckConfigError` code `invalid_option`.

#### Scenario: Default kind is noul

- **WHEN** `semantic({ intent: "…" })` is called
- **THEN** the rule has `kind: "noul"`

#### Scenario: Unknown kind is rejected

- **WHEN** a JavaScript caller passes `kind: "choice"`
- **THEN** it throws `EDcheckConfigError` with `code: "invalid_option"`

#### Scenario: Score options on a noul rule are rejected

- **WHEN** `semantic({ intent, levels: [...] })` or `semantic({ intent, minConfidence: 0.5 })` is called without `kind: "score"`
- **THEN** each throws `EDcheckConfigError` with `code: "invalid_option"`

#### Scenario: Noul options on a score rule are rejected

- **WHEN** `semantic({ kind: "score", intent, levels, thresholds: { pass: 0.9 } })`, `{ …, valid: "x" }` and `{ …, invalid: "y" }` are called
- **THEN** each throws `EDcheckConfigError` with `code: "invalid_option"`

### Requirement: Score rule options

`semantic({ kind: "score", intent, levels, minConfidence?, severity?, message?, id? })` SHALL
return a frozen Score rule. `levels` SHALL be an ordered list of at least two
`{ label, description?, outcome }` entries with distinct non-empty labels, non-empty descriptions
(defaulting to the label) and `outcome ∈ { "pass", "warning", "fail" }`. `minConfidence` SHALL be
in `[0, 1]`.

#### Scenario: Valid score rule

- **WHEN** `semantic({ kind: "score", intent: "How clear is the description?", levels: [{ label: "meaningless", description: "Random text", outcome: "fail" }, { label: "vague", outcome: "warning" }, { label: "clear", outcome: "pass" }], minConfidence: 0.7 })` is called
- **THEN** the rule has `kind: "score"`, three levels in order, `levels[1].description === "vague"`, `minConfidence: 0.7`, `severity: "error"`, and is frozen with a frozen `levels` array

#### Scenario: Fewer than two levels

- **WHEN** `levels` has one entry, and in a second call is `[]`
- **THEN** each throws `EDcheckConfigError` with `code: "invalid_rule"`

#### Scenario: Duplicate labels

- **WHEN** two levels share `label: "ok"`
- **THEN** it throws `EDcheckConfigError` with `code: "invalid_rule"`

#### Scenario: Empty label or description

- **WHEN** a level has `label: " "`, and in a second call `description: ""`
- **THEN** each throws `EDcheckConfigError` with `code: "invalid_rule"`

#### Scenario: Missing or unknown level outcome

- **WHEN** a JavaScript caller passes a level without `outcome`, and in a second call `outcome: "block"`
- **THEN** the first throws `code: "invalid_rule"` and the second `code: "invalid_option"`

#### Scenario: minConfidence out of range

- **WHEN** `minConfidence` is `1.2`, and in a second call `-0.1`
- **THEN** each throws `EDcheckConfigError` with `code: "invalid_confidence"`

#### Scenario: minConfidence boundaries accepted

- **WHEN** `minConfidence` is `0`, and in a second call `1`
- **THEN** both rules are created

#### Scenario: Levels are copied

- **GIVEN** `const levels = [{ label: "a", outcome: "fail" }, { label: "b", outcome: "pass" }]`
- **WHEN** `semantic({ kind: "score", intent, levels })` is created and then `levels.push({ label: "c", outcome: "pass" })` runs
- **THEN** the rule still has two levels

#### Scenario: Same score rule bound to two schemas

- **WHEN** one Score rule instance is bound to two different Zod objects
- **THEN** both `define` calls succeed and each compiled question uses its own path
