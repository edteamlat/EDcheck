## ADDED Requirements

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
