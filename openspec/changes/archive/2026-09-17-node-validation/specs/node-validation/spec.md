## ADDED Requirements

### Requirement: Node handle construction

`SemanticSchema.node(path)` SHALL resolve a leaf or object path of the bound schema once, reject
invalid paths with the same `EDcheckConfigError` codes as rule paths, and return a memoized
`SemanticNode` exposing `path`, `schema`, `ruleIds` and `safeParse`.

#### Scenario: Leaf node handle

- **GIVEN** `define(User, { rules: { fullName: semantic("A real name") } })`
- **WHEN** `node("fullName")` is called
- **THEN** it returns an object with `path: ["fullName"]`, `ruleIds: ["fullName"]`, a `schema` whose `safeParse("x").success` is `true`, and a function `safeParse`

#### Scenario: Object node handle

- **GIVEN** rules on `address.street` and `address.city` and a rule on `fullName`
- **WHEN** `node("address")` is called
- **THEN** `ruleIds` is `["address.street", "address.city"]` in declaration order and `path` is `["address"]`

#### Scenario: Handle is memoized

- **WHEN** `node("fullName")` is called twice
- **THEN** both calls return the same object (`Object.is`)

#### Scenario: Rule-less node is allowed

- **GIVEN** a schema whose only rule is on `fullName`
- **WHEN** `node("bio")` is called
- **THEN** it returns a handle with `ruleIds: []` and does not throw

#### Scenario: ruleIds is frozen

- **WHEN** a test attempts `(node.ruleIds as string[]).push("x")`
- **THEN** it throws in strict mode and `ruleIds` is unchanged

#### Scenario: Unknown path

- **WHEN** `node("nope" as never)` and, separately, `node("address.nope" as never)` and `node("" as never)` are called
- **THEN** each throws `EDcheckConfigError` `{ code: "unknown_path" }` whose message names the path

#### Scenario: Array path

- **GIVEN** a schema with `tags: z.array(z.string())` and `items: z.array(z.object({ name: z.string() }))`
- **WHEN** `node("tags" as never)` and `node("items.name" as never)` are called
- **THEN** each throws `{ code: "unsupported_node" }`

#### Scenario: Pipe node

- **GIVEN** `slug: z.string().pipe(z.string().min(1))`
- **WHEN** `node("slug" as never)` is called
- **THEN** it throws `{ code: "unsupported_node" }`

#### Scenario: Reserved path

- **GIVEN** a schema with a top-level `context: z.string()` field
- **WHEN** `node("context" as never)` is called
- **THEN** it throws `{ code: "reserved_path" }`

#### Scenario: Wrappers are kept on the resolved node

- **GIVEN** `nickname: z.string().trim().optional().default("anon")` with a rule on `nickname`
- **WHEN** `node("nickname").schema.parse(undefined)` and `.parse("  bob ")` are evaluated
- **THEN** they return `"anon"` and `"bob"` respectively

### Requirement: Rule selection for a node

A node SHALL run the field rules whose path equals or lies under the node path and, when cross-field
rules exist, the cross-field rules whose declared paths all lie under the node path. Other rules
SHALL be skipped without issue or request.

#### Scenario: Sibling rules are not selected

- **GIVEN** rules on `fullName` and `bio`
- **WHEN** `node("fullName").safeParse("Ada Lovelace")` runs
- **THEN** `mock.calls[0].questions` has exactly the key `fullName`

#### Scenario: Nested rules under an object node are selected

- **GIVEN** rules on `address.street`, `address.city` and `fullName`
- **WHEN** `node("address").safeParse({ street: "Main St 1", city: "Lima" })` runs
- **THEN** `Object.keys(mock.calls[0].questions)` is `["address.street", "address.city"]`

#### Scenario: Cross-field rule fully covered by the node

- **GIVEN** `crossField: [{ paths: ["address.city", "address.country"], rule }]` and `node("address")`
- **WHEN** `safeParse({ city: "Lima", country: "Peru" })` runs
- **THEN** `ruleIds` contains `"address.city+address.country"` and `mock.calls[0].questions` contains that key with `state.address` deep-equal to `{ city: "Lima", country: "Peru" }`

#### Scenario: Cross-field rule partially covered is skipped

- **GIVEN** `crossField: [{ paths: ["age", "occupation"], rule }]` and a field rule on `age`
- **WHEN** `node("age")` is created and `safeParse(30)` runs
- **THEN** `ruleIds` is `["age"]`, `mock.calls[0].questions` has only `age`, and `result.issues` is `[]`

#### Scenario: Node with only a partially covered cross-field rule

- **GIVEN** `crossField: [{ paths: ["age", "occupation"], rule }]` and no field rules
- **WHEN** `node("occupation").safeParse("pilot")` runs
- **THEN** the provider is never called and the result is `{ success: true, data: "pilot", issues: [] }`

### Requirement: Node pipeline

`SemanticNode.safeParse(value, options?)` SHALL validate `value` with the resolved node, prefix Zod
issue paths with the node path, exclude rules under invalid paths, skip nullish values, and compile,
execute and map the surviving rules exactly as the whole-object parse does.

#### Scenario: Shape failure on the node

- **GIVEN** a rule on `fullName`
- **WHEN** `node("fullName").safeParse(42)` runs
- **THEN** the provider is never called, `result.success` is `false`, and `result.issues[0]` has `path: ["fullName"]`, `severity: "error"` and the Zod `code` `invalid_type`

#### Scenario: Nested shape issue path is absolute

- **GIVEN** `node("address")` with a rule on `address.street`
- **WHEN** `safeParse({ street: 1, city: "Lima" })` runs
- **THEN** the Zod issue has `path: ["address", "street"]`

#### Scenario: Invalid child excludes only its rule

- **GIVEN** `node("address")` with rules on `address.street` and `address.city`
- **WHEN** `safeParse({ street: 1, city: "Lima" })` runs
- **THEN** `mock.calls[0].questions` has exactly `address.city`, and `result.issues` contains the Zod issue on `street` followed by any semantic issue on `city`

#### Scenario: Nullish value skips the rule

- **GIVEN** `nickname: z.string().optional()` with a rule on `nickname`
- **WHEN** `node("nickname").safeParse(undefined)` runs
- **THEN** the provider is never called and the result is `{ success: true, data: undefined, issues: [] }`

#### Scenario: Default value is evaluated

- **GIVEN** `nickname: z.string().default("anon")` with a rule on `nickname`
- **WHEN** `node("nickname").safeParse(undefined)` runs
- **THEN** `mock.calls[0].state` deep-equals `{ nickname: "anon" }` and `result.data` is `"anon"`

#### Scenario: Trimmed value is evaluated

- **GIVEN** `fullName: z.string().trim()` with a rule
- **WHEN** `node("fullName").safeParse("  Ada Lovelace  ")` runs
- **THEN** `mock.calls[0].state.fullName` is `"Ada Lovelace"`

#### Scenario: State mirrors the absolute structure

- **GIVEN** a rule on `address.street`
- **WHEN** `node("address.street").safeParse("Main St 1")` runs
- **THEN** `mock.calls[0].state` deep-equals `{ address: { street: "Main St 1" } }`

#### Scenario: Payload parity with whole-object parse

- **GIVEN** a schema whose only rule is on `fullName`
- **WHEN** `safeParse({ fullName: "Ada Lovelace", bio: "x" })` and `node("fullName").safeParse("Ada Lovelace")` run against two fresh mocks
- **THEN** the two recorded requests deep-equal each other (`state`, `questions`)

#### Scenario: Question text unchanged

- **WHEN** `node("fullName").safeParse("Ada Lovelace")` runs
- **THEN** `mock.calls[0].questions.fullName.instructions` equals the whole-object instructions for the same rule

#### Scenario: Extreme strings pass through

- **WHEN** `node("fullName").safeParse(v)` runs for `v` in `""`, a 20 000-character string, `"👩‍🚀 Ada"`, `"عادة لوفليس"`
- **THEN** `mock.calls[0].state.fullName` is `v` unchanged (or the provider is not called when the Zod node rejects `""` via `.min(1)`)

#### Scenario: Passthrough object node keeps unknown keys

- **GIVEN** `address: z.object({ street: z.string() }).passthrough()` with a rule on `address.street`
- **WHEN** `node("address").safeParse({ street: "Main St 1", extra: 1 })` runs
- **THEN** `result.data` deep-equals `{ street: "Main St 1", extra: 1 }` and `mock.calls[0].state` deep-equals `{ address: { street: "Main St 1" } }`

#### Scenario: Outcome mapping applies

- **GIVEN** `mockProvider({ answers: { fullName: 0.12 } })`
- **WHEN** `node("fullName").safeParse("asdf")` runs
- **THEN** `result.success` is `false` and `result.issues[0]` deep-equals the whole-object fail issue for `fullName` (same `path`, `code`, `severity`, `outcome`, `message`, `ruleId`, `probability`, `thresholds`, `provider`)

#### Scenario: Warning keeps success

- **GIVEN** `mockProvider({ answers: { fullName: 0.6 } })`
- **WHEN** `node("fullName").safeParse("Ada")` runs
- **THEN** `result.success` is `true` and the single issue has `severity: "warning"`

#### Scenario: Rule-less node performs only the shape check

- **GIVEN** `node("bio")` with no rules
- **WHEN** `safeParse("hello")` and `safeParse(5)` run
- **THEN** the provider is never called; the first result is `{ success: true, data: "hello", issues: [] }`, the second has one Zod issue with `path: ["bio"]`

### Requirement: Context preservation in node parses

A node parse SHALL send, for each rule, the same effective context the rule receives in a
whole-object parse, and SHALL group rules by that context exactly as the whole-object parse does.

#### Scenario: Instance and schema context reach the node

- **GIVEN** `createEDcheck({ provider, context: { domain: "hr" } })` and `define(User, { context: "Spanish-speaking users", rules })`
- **WHEN** `node("fullName").safeParse("Ada")` runs
- **THEN** `mock.calls[0].state.context` deep-equals `{ domain: "hr", notes: ["Spanish-speaking users"] }`

#### Scenario: Ancestor node context reaches a nested node

- **GIVEN** `nodeContext: { address: { purpose: "shipping" } }` and a rule on `address.street`
- **WHEN** `node("address.street").safeParse("Main St 1")` runs
- **THEN** `mock.calls[0].state.context.purpose` is `"shipping"`

#### Scenario: Rule context wins

- **GIVEN** instance `{ audience: "adults" }` and `semantic({ intent, context: { audience: "children" } })` on `fullName`
- **WHEN** `node("fullName").safeParse("Ada")` runs
- **THEN** `mock.calls[0].state.context.audience` is `"children"`

#### Scenario: Context parity with whole-object parse

- **GIVEN** the `context-inheritance` payload fixture (instance, schema, node and rule contexts)
- **WHEN** the whole object and `node("address.street")` are parsed against two fresh mocks
- **THEN** the `state.context` sent for `address.street` is deep-equal in both

#### Scenario: Distinct contexts inside an object node split requests

- **GIVEN** rules on `address.street` (context `{ audience: "a" }`) and `address.city` (context `{ audience: "b" }`)
- **WHEN** `node("address").safeParse({ street: "s", city: "c" })` runs
- **THEN** `mock.calls.length` is `2`, each with one question and its own `state.context.audience`

#### Scenario: Empty context adds no key

- **GIVEN** no context at any level
- **WHEN** `node("fullName").safeParse("Ada")` runs
- **THEN** `"context" in mock.calls[0].state` is `false`

### Requirement: Node cancellation and concurrency

`SemanticNode.safeParse` SHALL accept `signal` and `timeoutMs`, SHALL never emit a result for a
cancelled call, and SHALL keep overlapping calls on the same node independent.

#### Scenario: Pre-aborted signal

- **WHEN** `safeParse("Ada", { signal })` is called with an already-aborted signal
- **THEN** it rejects with `EDcheckAbortError` and the provider is never called

#### Scenario: Abort in flight with a late provider response

- **GIVEN** a hand-written provider whose `evaluate` returns a promise the test resolves manually and rejects with the signal's reason on abort
- **WHEN** `safeParse("Ada", { signal })` starts, `controller.abort()` is called, and the test then resolves the provider promise
- **THEN** the call rejects with `EDcheckAbortError`, no result is ever produced, and no `unhandledRejection` fires before the test ends

#### Scenario: Abort reason is preserved

- **WHEN** the caller aborts with `new Error("blurred again")`
- **THEN** `EDcheckAbortError.cause` is that error

#### Scenario: Overlapping calls, one aborted

- **GIVEN** `mockProvider({ delayMs: 100 })` and two controllers
- **WHEN** `safeParse("A", { signal: c1.signal })` and `safeParse("B", { signal: c2.signal })` start and `c1.abort()` is called after 10 ms
- **THEN** the first rejects with `EDcheckAbortError`, the second resolves, `mock.calls.length` is `2`, and `mock.calls[1].state.fullName` is `"B"`

#### Scenario: Overlapping calls resolve with their own values

- **GIVEN** a hand-written provider that answers `0.1` when `state.fullName === "asdf"` and `0.95` otherwise, releasing responses in the order the test chooses
- **WHEN** `p1 = safeParse("asdf")` and `p2 = safeParse("Ada Lovelace")` start and the provider releases `p2`'s request first
- **THEN** `await p1` has one `fail` issue and `await p2` has `issues: []`

#### Scenario: Timeout under open

- **GIVEN** `mockProvider({ delayMs: 500 })` and `timeoutMs: 20`
- **WHEN** `node("fullName").safeParse("Ada")` runs
- **THEN** it resolves with one `semantic_unavailable` warning on `["fullName"]` and the provider's signal is aborted

#### Scenario: Timeout under closed

- **GIVEN** the same with `policy: "closed"`
- **WHEN** the node parse runs
- **THEN** `success` is `false` and the issue has `severity: "error"`

#### Scenario: Per-call timeout overrides the instance timeout

- **GIVEN** an instance with `timeoutMs: 10000` and `mockProvider({ delayMs: 200 })`
- **WHEN** `safeParse("Ada", { timeoutMs: 20 })` runs
- **THEN** the result carries a `semantic_unavailable` issue instead of waiting 200 ms

#### Scenario: Fast provider leaves the caller signal untouched

- **WHEN** `safeParse("Ada", { signal: controller.signal })` resolves with `mockProvider()`
- **THEN** `controller.signal.aborted` is `false`

#### Scenario: No automatic supersession

- **GIVEN** `mockProvider({ delayMs: 50 })`
- **WHEN** `safeParse("A")` and `safeParse("B")` start back-to-back without signals
- **THEN** both resolve successfully and `mock.calls.length` is `2`

### Requirement: Node type contract

`node` SHALL accept only `NodePath<z.output<S>>` values and `SemanticNode.safeParse` SHALL resolve
to `SemanticResult<PathValue<z.output<S>, P>>`.

#### Scenario: Leaf path types data

- **WHEN** `const r = await UserSemantic.node("fullName").safeParse(x)` is type-checked
- **THEN** `r.data` is `string | undefined`

#### Scenario: Object path types data as the sub-object

- **WHEN** `node("address").safeParse(x)` is type-checked
- **THEN** `r.data` is `{ street: string; city: string } | undefined`

#### Scenario: Optional leaf

- **GIVEN** `nickname: z.string().optional()`
- **WHEN** `node("nickname").safeParse(x)` is type-checked
- **THEN** `r.data` is `string | undefined`

#### Scenario: Invalid paths are rejected at compile time

- **WHEN** `node("nope")`, `node("tags")`, `node("items.name")` and `node("")` are type-checked
- **THEN** each line requires `@ts-expect-error`

#### Scenario: Exported types

- **WHEN** `import type { SemanticNode, PathValue } from "edcheck"` is type-checked
- **THEN** `PathValue<{ a: { b: number } }, "a.b">` is `number` and `SemanticNode` is assignable from `UserSemantic.node("fullName")`

#### Scenario: Public surface unchanged

- **WHEN** `Object.keys(await import("edcheck"))` is sorted
- **THEN** it equals the list asserted before this change
