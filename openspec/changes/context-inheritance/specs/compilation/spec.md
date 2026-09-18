## MODIFIED Requirements

### Requirement: One request per validated object

Compilation SHALL group the surviving rules of a `safeParse` by identical effective context and
SHALL produce exactly one `SemanticRequest` per group. With a uniform context (including no context)
this is exactly one request per validated object. Each group's `state` SHALL contain only that
group's rule values, mirroring the schema structure, plus a `context` key when the group's effective
context is non-empty. Groups SHALL execute concurrently under one signal and one timeout, and a
failing group SHALL affect only its own rules.

#### Scenario: Six rules, one request, six questions

- **GIVEN** six rules on six fields
- **WHEN** valid data is parsed with `mockProvider()`
- **THEN** `mock.calls.length` is `1` and `Object.keys(mock.calls[0].questions).length` is `6`

#### Scenario: State is restricted to rule fields

- **GIVEN** `z.object({ fullName, age, email })` with a rule only on `fullName`
- **WHEN** data is parsed
- **THEN** `mock.calls[0].state` deep-equals `{ fullName: <value> }` with no `age` or `email`

#### Scenario: Nested state mirrors structure

- **GIVEN** rules on `"address.street"` and `"fullName"`
- **WHEN** data is parsed
- **THEN** `state` deep-equals `{ fullName: <v1>, address: { street: <v2> } }`

#### Scenario: Non-string primitives are sent as-is

- **GIVEN** rules on `age: z.number()` and `active: z.boolean()`
- **WHEN** data is `{ age: 7, active: true }`
- **THEN** `state` is `{ age: 7, active: true }` with original JSON types

#### Scenario: Uniform context is still one request

- **GIVEN** six rules and a schema-level context, no rule-level context
- **WHEN** parsed
- **THEN** `mock.calls.length` is `1` and `state.context` is the schema context

#### Scenario: Distinct rule contexts split into minimal groups

- **GIVEN** rules `a` and `b` with `{ audience: "x" }`, rule `c` with `{ audience: "y" }`, rule `d` without context, all under schema `{ domain: "d" }`
- **WHEN** parsed
- **THEN** `mock.calls.length` is `3`; call 1 has `state` `{ a, b, context: { domain: "d", audience: "x" } }` and questions `a`, `b`; call 2 has `{ c, context: { domain: "d", audience: "y" } }`; call 3 has `{ d, context: { domain: "d" } }`

#### Scenario: Group order follows first declared rule

- **GIVEN** rules declared `{ p: ctxA, q: ctxB, r: ctxA }`
- **WHEN** parsed
- **THEN** `mock.calls[0].questions` has keys `["p", "r"]` and `mock.calls[1].questions` has `["q"]`

#### Scenario: Excluded rules do not create a group

- **GIVEN** rule `a` with `{ audience: "x" }` failing shape and rule `b` with `{ audience: "y" }` passing
- **WHEN** parsed
- **THEN** `mock.calls.length` is `1` and its `context.audience` is `"y"`

#### Scenario: Groups run concurrently

- **GIVEN** three groups and `mockProvider({ delayMs: 100 })`
- **WHEN** parsed
- **THEN** total elapsed time is below `250` ms and all three groups' outcomes are in `result.issues` or absent because they passed

#### Scenario: Failing group is isolated

- **GIVEN** a provider that throws `EDcheckProviderError` only when `state.context.audience === "x"`, rules `a` (`audience: "x"`, answer irrelevant) and `b` (`audience: "y"`, answer `0.1`)
- **WHEN** parsed
- **THEN** `a` has a `semantic_unavailable` warning and `b` has a `semantic` fail issue with `probability: 0.1`

#### Scenario: Caller abort rejects the whole parse across groups

- **GIVEN** two groups and `mockProvider({ delayMs: 200 })`
- **WHEN** the caller aborts after 20 ms
- **THEN** `safeParse` rejects with `EDcheckAbortError` and both received signals are aborted

#### Scenario: Timeout applies to every group

- **GIVEN** two groups, `mockProvider({ delayMs: 500 })` and `timeoutMs: 30`
- **WHEN** parsed
- **THEN** every rule has a `semantic_unavailable` issue and the parse resolved in well under 500 ms

## ADDED Requirements

### Requirement: Context in state

When a group's effective context is non-empty, `state.context` SHALL be that object with structured
keys in merge insertion order and `notes` last. When it is empty, `state` SHALL have no `context`
key and the payload SHALL be byte-identical to a parse without context.

#### Scenario: Context key shape

- **GIVEN** instance `{ domain: "software" }`, rule context `"Spanish speakers"`
- **WHEN** parsed
- **THEN** `state` deep-equals `{ fullName: <value>, context: { domain: "software", notes: ["Spanish speakers"] } }`

#### Scenario: Empty effective context leaves the bootstrap payload unchanged

- **GIVEN** the bootstrap `full-name` fixture snapshot
- **WHEN** the same fixture is parsed with `context: {}` at every level
- **THEN** `mock.calls[0]` matches the existing snapshot without an update

#### Scenario: Snapshot with the PDR project context

- **GIVEN** `{ domain: "software services", purpose: "create_project", audience: "client", locale: "es-BO" }` on the schema and the `full-name` fixture rule
- **WHEN** the first `es` positive case is parsed
- **THEN** `mock.calls[0]` matches the stored context snapshot
