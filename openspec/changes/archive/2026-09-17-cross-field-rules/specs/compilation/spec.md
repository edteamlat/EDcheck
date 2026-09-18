## ADDED Requirements

### Requirement: Cross-field question template

Each surviving cross-field rule SHALL compile to a Noul question keyed by its rule id with
`instructions: "Is the following statement true about <path list>? <intent>"`, where the path list
is the declared paths in declared order, each in backticks, joined as `` `a` ``, `` `a` and `b` ``
or `` `a`, `b` and `c` ``. `criteria` SHALL follow the field-rule rules.

#### Scenario: Two paths

- **WHEN** a binding on `["age", "occupation"]` with intent `"The \`occupation\` is plausible given \`age\`"` is compiled
- **THEN** `instructions` is "Is the following statement true about \`age\` and \`occupation\`? The \`occupation\` is plausible given \`age\`"

#### Scenario: One path

- **WHEN** a binding on `["address"]` is compiled
- **THEN** `instructions` starts with "Is the following statement true about \`address\`?"

#### Scenario: Three paths

- **WHEN** a binding on `["a", "b", "c"]` is compiled
- **THEN** `instructions` starts with "Is the following statement true about \`a\`, \`b\` and \`c\`?"

#### Scenario: Nested paths keep dots

- **WHEN** a binding on `["address.city", "address.country"]` is compiled
- **THEN** the path list is "\`address.city\` and \`address.country\`"

#### Scenario: Criteria map like field rules

- **WHEN** the rule has `valid` and `invalid`
- **THEN** `criteria` deep-equals `{ true: <valid>, false: <invalid> }`; with neither, `criteria` is absent

#### Scenario: Snapshot for the PDR age/occupation rule

- **GIVEN** the `age-occupation` fixture rule bound to `Person`
- **WHEN** the first `en` negative case is parsed
- **THEN** `mock.calls[0]` matches the stored snapshot

### Requirement: Cross-field rules share the object request

Cross-field rules SHALL be compiled into the same request as the object's field rules. `state`
SHALL be the union of surviving field-rule paths and surviving declared paths, mirroring structure,
with each path present once. Questions SHALL be ordered field rules first (map order), then
cross-field bindings (array order).

#### Scenario: One request for field and cross-field rules

- **GIVEN** field rules on `fullName` and `bio` and a binding on `["age", "occupation"]`
- **WHEN** parsed
- **THEN** `mock.calls.length` is `1` and `Object.keys(questions)` is `["fullName", "bio", "age+occupation"]`

#### Scenario: Union state

- **GIVEN** the same setup
- **WHEN** parsed
- **THEN** `state` deep-equals `{ fullName, bio, age, occupation }` and nothing else

#### Scenario: Shared path appears once

- **GIVEN** a field rule on `occupation` and a binding on `["age", "occupation"]`
- **WHEN** parsed
- **THEN** `Object.keys(state)` is `["occupation", "age"]`

#### Scenario: Excluded cross-field rule contributes no paths

- **GIVEN** a field rule on `fullName` and a binding on `["age", "occupation"]` skipped because `occupation` is `undefined`
- **WHEN** parsed
- **THEN** `state` deep-equals `{ fullName }`

#### Scenario: Two bindings keep array order

- **GIVEN** bindings declared `[["bio", "occupation"], ["age", "occupation"]]`
- **WHEN** parsed
- **THEN** `Object.keys(questions)` ends with `["bio+occupation", "age+occupation"]`
