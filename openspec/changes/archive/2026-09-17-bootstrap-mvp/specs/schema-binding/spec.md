## ADDED Requirements

### Requirement: Instance creation

`createEDcheck(options)` SHALL return an `EDcheck` instance holding the provider, `timeoutMs`
(default `10000`), `policy` (default `"open"`) and instance thresholds (default `DEFAULT_THRESHOLDS`).
Options SHALL be validated at creation time.

#### Scenario: Instance with defaults

- **WHEN** `createEDcheck({ provider: mockProvider() })` is called
- **THEN** it returns an object exposing `define` and no other own enumerable members

#### Scenario: Missing provider is rejected

- **WHEN** `createEDcheck({})` is called by a JavaScript caller
- **THEN** it throws `EDcheckConfigError` with `code: "invalid_option"`

#### Scenario: Invalid instance thresholds are rejected

- **WHEN** `createEDcheck({ provider, thresholds: { pass: 0.3, fail: 0.7 } })` is called
- **THEN** it throws `EDcheckConfigError` with `code: "invalid_thresholds"`

#### Scenario: Invalid policy is rejected

- **WHEN** `createEDcheck({ provider, policy: "maybe" })` is called by a JavaScript caller
- **THEN** it throws `EDcheckConfigError` with `code: "invalid_option"`

#### Scenario: Non-positive timeout is rejected

- **WHEN** `createEDcheck({ provider, timeoutMs: 0 })` is called
- **THEN** it throws `EDcheckConfigError` with `code: "invalid_option"`

### Requirement: Server-only guard

Semantic validation MUST fail with `EDcheckEnvironmentError` in a browser environment. Detection:
`globalThis.window` and `globalThis.document` are both defined.

#### Scenario: createEDcheck in a browser

- **GIVEN** `window` and `document` are defined on `globalThis`
- **WHEN** `createEDcheck({ provider })` is called
- **THEN** it throws `EDcheckEnvironmentError` whose message contains "API route"

#### Scenario: safeParse in a browser after creation elsewhere

- **GIVEN** an instance and bound schema created while `window` was undefined
- **WHEN** `window` and `document` are defined and `bound.safeParse(data)` is called
- **THEN** the promise rejects with `EDcheckEnvironmentError` and the provider is not called

#### Scenario: Node without window is allowed

- **WHEN** `createEDcheck({ provider })` runs in Node with no `window`
- **THEN** no error is thrown

### Requirement: Binding rules to leaf paths

`instance.define(schema, { rules, thresholds?, policy? })` SHALL resolve every rule key as a dotted
path through `z.object` shapes, unwrapping `optional`, `nullable`, `default`, `prefault`,
`readonly`, `catch` and `nonoptional`, and SHALL accept only primitive leaves (`string`, `number`,
`boolean`, `enum`, `literal`). Resolution happens once, at `define` time.

#### Scenario: Top-level primitive fields

- **WHEN** `define(z.object({ fullName: z.string(), age: z.number() }), { rules: { fullName: semantic("…") } })` is called
- **THEN** it returns a `SemanticSchema` whose `schema` is the same reference passed in

#### Scenario: Nested dotted path

- **WHEN** the schema is `z.object({ address: z.object({ street: z.string() }) })` and the rule key is `"address.street"`
- **THEN** `define` succeeds and the compiled request state is `{ address: { street: <value> } }`

#### Scenario: Wrapped primitive leaves are accepted

- **WHEN** rule keys point to `z.string().optional()`, `z.string().nullable()`, `z.string().default("x")`, `z.enum(["a", "b"])` and `z.literal("ok")`
- **THEN** `define` succeeds for all of them

#### Scenario: Unknown path

- **WHEN** the rule key is `"nickname"` and the shape has no `nickname`
- **THEN** `define` throws `EDcheckConfigError` with `code: "unknown_path"` and `path: "nickname"`

#### Scenario: Unknown nested segment

- **WHEN** the rule key is `"address.zip"` and `address` has no `zip`
- **THEN** `define` throws `EDcheckConfigError` with `code: "unknown_path"` and `path: "address.zip"`

#### Scenario: Rule on an array node

- **WHEN** the rule key is `"tags"` and `tags` is `z.array(z.string())`
- **THEN** `define` throws `EDcheckConfigError` with `code: "unsupported_node"` whose message mentions arrays and v1

#### Scenario: Rule through an array

- **WHEN** the rule key is `"items.0.name"` or `"items.name"` and `items` is `z.array(z.object({ name: z.string() }))`
- **THEN** `define` throws `EDcheckConfigError` with `code: "unsupported_node"`

#### Scenario: Rule on an object node

- **WHEN** the rule key is `"address"` and `address` is a `z.object`
- **THEN** `define` throws `EDcheckConfigError` with `code: "unsupported_node"`

#### Scenario: Rule on a transformed node

- **WHEN** the rule key points to `z.string().transform((s) => s.length)`
- **THEN** `define` throws `EDcheckConfigError` with `code: "unsupported_node"`

#### Scenario: Root schema is not an object

- **WHEN** `define(z.string(), { rules: {} })` is called by a JavaScript caller
- **THEN** it throws `EDcheckConfigError` with `code: "unsupported_schema"`

#### Scenario: Duplicate rule ids

- **WHEN** two rules with `id: "same"` are bound to two different paths
- **THEN** `define` throws `EDcheckConfigError` with `code: "duplicate_rule_id"`

#### Scenario: Empty rules map

- **WHEN** `define(schema, { rules: {} })` is called
- **THEN** it succeeds and `safeParse` never calls the provider

#### Scenario: Schema-level thresholds are validated against the effective merge

- **GIVEN** an instance with `thresholds: { pass: 0.9 }`
- **WHEN** `define(schema, { rules, thresholds: { fail: 0.95 } })` is called
- **THEN** it throws `EDcheckConfigError` with `code: "invalid_thresholds"` because effective `fail > pass`

#### Scenario: Zod schema is not mutated

- **WHEN** `define` is called on a schema
- **THEN** `schema.shape`, `schema.safeParse(validInput).success` and `Object.keys(schema)` are identical before and after

### Requirement: Shape-first execution

`safeParse` SHALL run `schema.safeParse(data)` first. A semantic rule MUST NOT execute when a Zod
issue path is a prefix of the rule path. Surviving rules SHALL receive the node's Zod output value.
Rules whose value is `undefined` or `null` are skipped without an issue.

#### Scenario: Shape passes, all rules run in one call

- **GIVEN** a schema with six rules on six primitive fields
- **WHEN** valid data is parsed
- **THEN** the provider is called exactly once with six questions and `result.data` equals the Zod output

#### Scenario: Shape failure on one node excludes only that node

- **GIVEN** rules on `fullName` and `bio`, and `bio` is `z.string().min(10)`
- **WHEN** data has a valid `fullName` and a 3-character `bio`
- **THEN** the provider is called exactly once, the request has a `fullName` question and no `bio` question, `state` has no `bio` key, and the Zod `too_small` issue on `["bio"]` is in `result.issues`

#### Scenario: Shape failure on every rule node makes zero calls

- **GIVEN** rules on `fullName` and `bio`
- **WHEN** both fields fail shape
- **THEN** the provider is never called, `result.success` is `false` and `result.issues` contains only the Zod issues

#### Scenario: Root-level Zod issue excludes all rules

- **GIVEN** `z.strictObject({ fullName: z.string() })` with a rule on `fullName`
- **WHEN** data has an unrecognized key
- **THEN** the provider is never called and the `unrecognized_keys` issue at path `[]` is in `result.issues`

#### Scenario: Surviving node receives its Zod output when a sibling failed

- **GIVEN** rules on `fullName: z.string().trim()` and `bio: z.string().min(10)`
- **WHEN** data is `{ fullName: "  Ana Pérez  ", bio: "x" }`
- **THEN** the compiled `state.fullName` is `"Ana Pérez"`

#### Scenario: Default value is what the provider sees

- **GIVEN** a rule on `role: z.string().default("member")`
- **WHEN** data omits `role`
- **THEN** the compiled `state.role` is `"member"`

#### Scenario: Optional value absent skips the rule

- **GIVEN** rules on `fullName` and `bio: z.string().optional()`
- **WHEN** data omits `bio`
- **THEN** the request has only the `fullName` question and `result.issues` has no issue for `bio`

#### Scenario: Only rule absent means zero calls

- **GIVEN** a single rule on `bio: z.string().nullable()`
- **WHEN** data is `{ bio: null }`
- **THEN** the provider is never called and `result` is `{ success: true, data, issues: [] }`

#### Scenario: Zod issue inside an array passes through and does not affect rules

- **GIVEN** `z.object({ fullName: z.string(), tags: z.array(z.string().min(2)) })` with a rule on `fullName`
- **WHEN** `tags` is `["ok", "x"]`
- **THEN** the provider is called once for `fullName` and `result.issues` contains the Zod issue with `path: ["tags", 1]`

### Requirement: Cancellation and timeout

Every `safeParse` SHALL accept `signal` and `timeoutMs`. A cancelled parse MUST NOT emit a result:
it rejects with `EDcheckAbortError`. Timeout is a provider failure, not a cancellation.

#### Scenario: Pre-aborted signal

- **WHEN** `safeParse(data, { signal })` is called with an already-aborted signal
- **THEN** the promise rejects with `EDcheckAbortError` and the provider is never called

#### Scenario: Abort in flight

- **GIVEN** a `mockProvider({ delayMs: 200 })`
- **WHEN** `signal.abort()` is called 20 ms after `safeParse` starts
- **THEN** the promise rejects with `EDcheckAbortError`, the provider's received signal is aborted, and no `unhandledRejection` event fires before the test ends

#### Scenario: Abort reason is preserved

- **WHEN** the caller aborts with `controller.abort(new Error("user navigated"))`
- **THEN** the `EDcheckAbortError.cause` is that same error

#### Scenario: Timeout is a provider failure under open policy

- **GIVEN** `mockProvider({ delayMs: 500 })` and `timeoutMs: 20`
- **WHEN** `safeParse(data)` runs without a caller signal
- **THEN** the promise resolves, the provider's signal was aborted, and `result.issues` has a `semantic_unavailable` warning per rule

#### Scenario: Per-call timeout overrides the instance timeout

- **GIVEN** an instance with `timeoutMs: 10000` and `mockProvider({ delayMs: 200 })`
- **WHEN** `safeParse(data, { timeoutMs: 20 })` is called
- **THEN** the result carries `semantic_unavailable` issues instead of waiting 200 ms

#### Scenario: Caller signal does not abort when the provider is fast

- **GIVEN** `mockProvider()` with no delay and a live `AbortController`
- **WHEN** `safeParse(data, { signal: controller.signal })` resolves
- **THEN** the result is complete and `controller.signal.aborted` is `false`
