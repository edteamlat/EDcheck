## Purpose

Normalize, attach, and merge validation context across instance, schema, node, and rule levels, and send it only in `state` so locale and notes never become filters or prompt interpolation.

## Requirements

### Requirement: Context forms and normalization

A context SHALL be either a non-empty string or an object with optional reserved keys `domain`,
`purpose`, `audience`, `locale`, `channel` (strings), an optional `notes: string[]` and open keys.
A string SHALL normalize to `{ notes: [string] }`. Invalid contexts MUST be rejected at the level
where they are attached with `EDcheckConfigError` code `invalid_context`.

#### Scenario: String context becomes a note

- **WHEN** `createEDcheck({ provider, context: "Client intake form" })` binds a rule and parses
- **THEN** `mock.calls[0].state.context` deep-equals `{ notes: ["Client intake form"] }`

#### Scenario: Object context is carried as-is

- **WHEN** the schema context is `{ domain: "software", purpose: "project intake", tenant: "acme" }`
- **THEN** `state.context` deep-equals that object, open key included

#### Scenario: Notes array at one level is preserved in order

- **WHEN** the schema context is `{ notes: ["first", "second"] }`
- **THEN** `state.context.notes` is `["first", "second"]`

#### Scenario: Empty string context is rejected

- **WHEN** `createEDcheck({ provider, context: "   " })` is called
- **THEN** it throws `EDcheckConfigError` with `code: "invalid_context"`

#### Scenario: Reserved key with a non-string value is rejected

- **WHEN** `define(schema, { rules, context: { locale: 42 } })` is called by a JavaScript caller
- **THEN** it throws `EDcheckConfigError` with `code: "invalid_context"`

#### Scenario: Invalid notes are rejected

- **WHEN** `semantic({ intent, context: { notes: ["ok", ""] } })` and, separately, `{ notes: "text" }` are passed
- **THEN** each throws `EDcheckConfigError` with `code: "invalid_context"`

#### Scenario: Non-object non-string is rejected

- **WHEN** `define(schema, { rules, context: 7 })` is called by a JavaScript caller
- **THEN** it throws `EDcheckConfigError` with `code: "invalid_context"`

#### Scenario: Empty object is a no-op

- **WHEN** `define(schema, { rules, context: {} })` parses
- **THEN** `state` has no `context` key

#### Scenario: Undefined values are ignored

- **WHEN** a JavaScript caller passes `context: { domain: "x", purpose: undefined }`
- **THEN** `state.context` deep-equals `{ domain: "x" }`

#### Scenario: Caller mutation after attachment does not leak

- **GIVEN** `const ctx = { domain: "a", notes: ["n"] }` passed to `semantic({ intent, context: ctx })`
- **WHEN** `ctx.domain = "b"` and `ctx.notes.push("m")` run before parsing
- **THEN** `state.context` deep-equals `{ domain: "a", notes: ["n"] }`

### Requirement: Attachment levels

Context SHALL be attachable at the instance (`createEDcheck`), schema (`define`), node
(`define` → `nodeContext` keyed by object or leaf path) and rule (`semantic({ context })`) levels.
Node paths SHALL be validated at `define` time with the same errors as rule paths, except that
object paths are accepted.

#### Scenario: Instance level reaches every rule

- **GIVEN** `createEDcheck({ provider, context: { domain: "hr" } })` and two rules without context
- **WHEN** parsed
- **THEN** one request is made and `state.context` is `{ domain: "hr" }`

#### Scenario: Schema level

- **WHEN** `define(schema, { rules, context: { purpose: "signup" } })` parses
- **THEN** `state.context` is `{ purpose: "signup" }`

#### Scenario: Node level on an object path reaches nested rules

- **GIVEN** rules on `address.street` and `fullName`, and `nodeContext: { address: { locale: "es-BO" } }`
- **WHEN** parsed
- **THEN** the `address.street` rule's request has `state.context.locale === "es-BO"` and the `fullName` rule's request has no `locale`

#### Scenario: Node level on a leaf path

- **WHEN** `nodeContext: { fullName: "Legal name as in the ID" }` is set
- **THEN** the `fullName` rule's `state.context.notes` includes `"Legal name as in the ID"`

#### Scenario: Rule level

- **WHEN** `semantic({ intent, context: { audience: "children" } })` is bound and parsed
- **THEN** `state.context.audience` is `"children"`

#### Scenario: Basic string rule form has no rule context

- **WHEN** `semantic("A plausible name")` is bound under a schema context
- **THEN** the rule receives exactly the schema context

#### Scenario: Unknown node path

- **WHEN** `nodeContext: { nickname: "x" }` and the shape has no `nickname`
- **THEN** `define` throws `EDcheckConfigError` with `code: "unknown_path"` and `path: "nickname"`

#### Scenario: Node path on an array

- **WHEN** `nodeContext: { tags: "x" }` and `tags` is `z.array(z.string())`
- **THEN** `define` throws `EDcheckConfigError` with `code: "unsupported_node"`

#### Scenario: Node context without a rule beneath it is allowed

- **WHEN** `nodeContext: { address: { locale: "es" } }` and no rule lives under `address`
- **THEN** `define` succeeds and no request contains `locale`

### Requirement: Deterministic merge

The effective context of a rule SHALL be the ordered merge `instance → schema → node ancestors
(root-most first) → rule`. Structured keys SHALL shallow-merge with the most specific level
winning. `notes` SHALL concatenate in that order and SHALL never override a structured key. Merge
happens once at `define` time.

#### Scenario: Rule with no context inherits everything above

- **GIVEN** instance `{ domain: "hr" }`, schema `{ purpose: "signup" }`, node `fullName: { channel: "web" }`
- **WHEN** a context-less rule on `fullName` is parsed
- **THEN** `state.context` deep-equals `{ domain: "hr", purpose: "signup", channel: "web" }`

#### Scenario: Three-level conflict resolves to the most specific

- **GIVEN** instance `{ audience: "public" }`, schema `{ audience: "clients" }`, rule `{ audience: "freelancers" }`
- **WHEN** parsed
- **THEN** `state.context.audience` is `"freelancers"`

#### Scenario: Node beats schema, rule beats node

- **GIVEN** schema `{ locale: "en" }`, node `fullName: { locale: "es" }`, rule `{ locale: "es-BO" }`
- **WHEN** parsed
- **THEN** `state.context.locale` is `"es-BO"`; with the rule context removed it is `"es"`

#### Scenario: Ancestor node order

- **GIVEN** `nodeContext: { address: { locale: "en", notes: ["a"] }, "address.street": { locale: "es", notes: ["b"] } }` and a rule on `address.street`
- **WHEN** parsed
- **THEN** `state.context` deep-equals `{ locale: "es", notes: ["a", "b"] }`

#### Scenario: Notes accumulate across levels in inheritance order

- **GIVEN** instance `"I"`, schema `"S"`, node `fullName: "N"`, rule `{ intent, context: "R" }`
- **WHEN** parsed
- **THEN** `state.context.notes` is `["I", "S", "N", "R"]` and `context` has no other key

#### Scenario: String never overrides structured keys

- **GIVEN** schema `{ domain: "software", locale: "es" }` and rule context `"Focus on tone"`
- **WHEN** parsed
- **THEN** `state.context` deep-equals `{ domain: "software", locale: "es", notes: ["Focus on tone"] }`

#### Scenario: Open keys follow the same precedence

- **GIVEN** instance `{ tenant: "a", plan: "free" }` and rule `{ tenant: "b" }`
- **WHEN** parsed
- **THEN** `state.context` deep-equals `{ tenant: "b", plan: "free" }`

#### Scenario: Key insertion order is stable

- **GIVEN** instance `{ domain: "x" }`, rule `{ locale: "es", domain: "y" }`
- **WHEN** parsed
- **THEN** `Object.keys(state.context)` is `["domain", "locale"]`

#### Scenario: Notes are always last

- **GIVEN** instance `"note"` and rule `{ domain: "x" }`
- **WHEN** parsed
- **THEN** `Object.keys(state.context)` is `["domain", "notes"]`

#### Scenario: Merge is resolved at define time

- **GIVEN** a bound schema whose instance was created with a mutable context object
- **WHEN** the caller mutates that object after `define` and then parses
- **THEN** `state.context` reflects the values at `define` time

### Requirement: Reserved keys and locale semantics

The reserved keys SHALL be `domain`, `purpose`, `audience`, `locale`, `channel` and `notes`.
`locale` MUST behave as context only: it SHALL NOT alter instructions or criteria, exclude any
rule, or change any outcome computation.

#### Scenario: Locale only appears in state

- **GIVEN** the same rule bound once with `{ locale: "es-BO" }` and once without context
- **WHEN** both are parsed with the same data
- **THEN** both requests have identical `questions` and only the first has `state.context.locale`

#### Scenario: Reserved keys are strings at the type level

- **WHEN** `context: { locale: 42 }` is type-checked
- **THEN** it fails to compile (`@ts-expect-error`), while `{ tenant: 42 }` compiles (type test)

### Requirement: Context travels only in state

Context text MUST NOT appear in `instructions` or `criteria`. The reserved top-level state key
`context` MUST NOT collide with a rule or node path.

#### Scenario: Instructions are identical with and without context

- **GIVEN** a rule parsed under `{ domain: "unique-marker-domain", notes: ["unique-marker-note"] }`
- **WHEN** `JSON.stringify(mock.calls[0].questions)` is inspected
- **THEN** it contains neither marker and equals the questions compiled without context

#### Scenario: Rule path named context is rejected

- **WHEN** `define(z.object({ context: z.string() }), { rules: { context: semantic("…") } })` is called
- **THEN** it throws `EDcheckConfigError` with `code: "reserved_path"` and `path: "context"`

#### Scenario: Nested rule path under context is rejected

- **WHEN** the rule key is `"context.value"` on `z.object({ context: z.object({ value: z.string() }) })`
- **THEN** it throws `EDcheckConfigError` with `code: "reserved_path"`

#### Scenario: Node context path named context is rejected

- **WHEN** `nodeContext: { context: "x" }` is passed for a schema with a `context` field
- **THEN** it throws `EDcheckConfigError` with `code: "reserved_path"`

#### Scenario: A field named context without rules is fine

- **WHEN** the schema has a `context` field, no rule or node context targets it, and a rule on `fullName` is parsed
- **THEN** `define` succeeds and `state` is `{ fullName: <value> }` plus the effective `context` object
