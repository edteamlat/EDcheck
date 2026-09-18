## ADDED Requirements

### Requirement: Hook registration

`createEDcheck({ hooks })` SHALL accept optional `onRequest`, `onResponse` and `onError` functions
and SHALL reject any other shape with `EDcheckConfigError` code `invalid_option`.

#### Scenario: Hooks are optional

- **WHEN** `createEDcheck({ provider })` and `createEDcheck({ provider, hooks: {} })` are called
- **THEN** neither throws and `safeParse` behaves identically for both

#### Scenario: Partial registration

- **WHEN** `createEDcheck({ provider, hooks: { onResponse } })` parses valid data with one rule
- **THEN** `onResponse` is called once and no error is thrown for the missing hooks

#### Scenario: Non-function hook

- **WHEN** `createEDcheck({ provider, hooks: { onRequest: "log" as never } })` is called
- **THEN** it throws `EDcheckConfigError` `{ code: "invalid_option" }` whose message names `onRequest`

#### Scenario: Unknown hook key

- **WHEN** `createEDcheck({ provider, hooks: { onFinish: () => {} } as never })` is called
- **THEN** it throws `{ code: "invalid_option" }` whose message names `onFinish`

#### Scenario: Null hooks

- **WHEN** `createEDcheck({ provider, hooks: null as never })` is called
- **THEN** it throws `{ code: "invalid_option" }`

### Requirement: Request events

`onRequest` SHALL fire synchronously once per provider request, before `provider.evaluate` is
called, with the compiled `SemanticRequest` and correlation fields.

#### Scenario: One request event per parse with uniform context

- **GIVEN** two rules and no context
- **WHEN** `safeParse(validData)` runs
- **THEN** `onRequest` was called exactly once with `requestIndex: 0`, `requestCount: 1`, `ruleIds` equal to `Object.keys(mock.calls[0].questions)` and `entry: "object"`

#### Scenario: Request object identity

- **WHEN** `safeParse(validData)` runs
- **THEN** `requestEvents[0].request` is the same reference as `mock.calls[0]`

#### Scenario: Fires before the provider is called

- **GIVEN** a hand-written provider that records `requestEvents.length` when `evaluate` is entered
- **WHEN** `safeParse(validData)` runs
- **THEN** the recorded length is `1`

#### Scenario: Provider name and ids

- **WHEN** `safeParse(validData)` runs with `mockProvider()`
- **THEN** the event has `provider: "mock"`, a `parseId` and a `requestId` matching `/^[0-9a-f-]{36}$/`, and `timestamp` between the test's start and end `Date.now()`

#### Scenario: Distinct parses have distinct parseIds

- **WHEN** `safeParse` runs twice
- **THEN** the two request events have different `parseId` and different `requestId`

#### Scenario: Synchronous provider throw still fires onRequest

- **GIVEN** a hand-written provider whose `evaluate` throws synchronously
- **WHEN** `safeParse(validData)` runs
- **THEN** `onRequest` fired once and `onError` fired once

### Requirement: Response events

`onResponse` SHALL fire once per request that produced a contract-valid response, after outcome
mapping and before the parse promise settles, with the `SemanticResponse`, per-rule `outcomes` and
`durationMs`.

#### Scenario: Response event content

- **GIVEN** `mockProvider({ answers: { fullName: 0.95, bio: 0.6 }, model: "mock" })` and rules on `fullName` and `bio`
- **WHEN** `safeParse(validData)` runs
- **THEN** `onResponse` was called once with `response.model: "mock"`, `response.answers.fullName.noul: 0.95`, `outcomes` deep-equal to `{ fullName: "pass", bio: "warning" }`, and `parseId`/`requestId` equal to the request event's

#### Scenario: Fail outcome is reported

- **GIVEN** `mockProvider({ answers: { fullName: 0.1 } })`
- **WHEN** parsed
- **THEN** `outcomes.fullName` is `"fail"` and the parse result has one `error` issue

#### Scenario: Usage is carried

- **GIVEN** a hand-written provider returning `usage: { inputTokens: 120, outputTokens: 8 }`
- **WHEN** parsed
- **THEN** `responseEvents[0].response.usage` deep-equals `{ inputTokens: 120, outputTokens: 8 }`

#### Scenario: Duration reflects provider latency

- **GIVEN** `mockProvider({ delayMs: 40 })`
- **WHEN** parsed
- **THEN** `durationMs` is a finite number `>= 30`

#### Scenario: Fires before the parse settles

- **WHEN** `await safeParse(validData)` returns
- **THEN** `responseEvents.length` is already `1` without any further await

#### Scenario: Exactly one terminal event per request

- **WHEN** `safeParse(validData)` runs with a succeeding mock
- **THEN** `onResponse` fired once and `onError` never fired

### Requirement: Error events

`onError` SHALL fire once per request that failed, with `kind` `"provider"` for
`EDcheckProviderError` (including timeout and malformed response), `"abort"` for caller
cancellation, and `"unexpected"` for any other thrown value, and `onResponse` SHALL NOT fire for
that request.

#### Scenario: Provider error

- **GIVEN** `mockProvider({ error: new EDcheckProviderError("http", { status: 503 }) })`
- **WHEN** parsed under `open`
- **THEN** `onError` fired once with `kind: "provider"`, `error` being that same instance, `durationMs >= 0`, and the result carries `semantic_unavailable` warnings

#### Scenario: Timeout

- **GIVEN** `mockProvider({ delayMs: 500 })` and `timeoutMs: 20`
- **WHEN** parsed
- **THEN** `onError` fired once with `kind: "provider"` and `error.code === "timeout"`, and `onResponse` never fired

#### Scenario: Malformed response

- **GIVEN** `mockProvider({ answers: () => 2 })`
- **WHEN** parsed
- **THEN** `onError` fired once with `kind: "provider"` and `error.code === "malformed_response"`

#### Scenario: Caller abort

- **GIVEN** `mockProvider({ delayMs: 200 })` and a controller aborted after 20 ms with `new Error("nav")`
- **WHEN** `safeParse(validData, { signal })` rejects
- **THEN** `onError` fired once with `kind: "abort"`, `error` being the same `EDcheckAbortError` instance the promise rejected with, and `error.cause.message === "nav"`

#### Scenario: Unexpected error

- **GIVEN** a hand-written provider rejecting with `new Error("boom")`
- **WHEN** `safeParse(validData)` rejects
- **THEN** `onError` fired once with `kind: "unexpected"` and `error.message === "boom"`, and the parse rejected with that error

#### Scenario: Error event fires before rejection settles

- **WHEN** `safeParse` rejects for any of the cases above
- **THEN** `errorEvents.length` is `1` at the moment the rejection is observed

#### Scenario: Under closed policy the event is identical

- **GIVEN** the provider error scenario with `policy: "closed"`
- **WHEN** parsed
- **THEN** the `onError` event deep-equals the `open` one except for `durationMs`, `timestamp` and ids, and the result has `error` severity issues

### Requirement: Zero-request parses fire nothing

Parses that make no provider request SHALL fire no hook.

#### Scenario: Root shape failure

- **WHEN** `safeParse(42)` runs
- **THEN** no hook was called and the result has only Zod issues

#### Scenario: All rules excluded by shape

- **GIVEN** a single rule on `fullName` and data with `fullName: 7`
- **WHEN** parsed
- **THEN** no hook was called

#### Scenario: Nullish-only values

- **GIVEN** an optional `nickname` rule and data without `nickname`
- **WHEN** parsed
- **THEN** no hook was called

#### Scenario: Pre-aborted signal

- **WHEN** `safeParse(validData, { signal: abortedSignal })` rejects with `EDcheckAbortError`
- **THEN** no hook was called

### Requirement: Hook isolation

A hook that throws, returns a rejected promise or never settles SHALL NOT change the parse result,
delay it beyond the provider latency, or cause an `unhandledRejection`.

#### Scenario: Throwing onRequest

- **GIVEN** `onRequest: () => { throw new Error("hook") }`
- **WHEN** parsed
- **THEN** the result deep-equals the result without hooks and `mock.calls.length` is `1`

#### Scenario: Throwing onResponse

- **GIVEN** `onResponse` that throws
- **WHEN** parsed
- **THEN** the result deep-equals the result without hooks

#### Scenario: Throwing onError

- **GIVEN** `onError` that throws and `mockProvider({ error })`
- **WHEN** parsed under `open`
- **THEN** the result carries `semantic_unavailable` warnings exactly as without hooks

#### Scenario: Rejected hook promise

- **GIVEN** `onResponse: async () => { throw new Error("late") }` and an `unhandledRejection` listener installed for the test
- **WHEN** parsed and a macrotask elapses
- **THEN** the listener was not called and the result is unchanged

#### Scenario: Never-settling hook promise

- **GIVEN** `onResponse: () => new Promise(() => {})` and `mockProvider()`
- **WHEN** parsed
- **THEN** the parse resolves within `100` ms

#### Scenario: Hook return value is ignored

- **GIVEN** `onRequest: () => ({ cancel: true }) as never`
- **WHEN** parsed
- **THEN** the provider is called and the result is unchanged

#### Scenario: Hook cannot swallow the abort

- **GIVEN** `onError` that throws and a caller abort in flight
- **WHEN** `safeParse` runs
- **THEN** it still rejects with `EDcheckAbortError`

### Requirement: No output by default

The library SHALL NOT write to `process.stdout`, `process.stderr` or `console` during any parse,
with or without hooks.

#### Scenario: Silent across outcomes

- **GIVEN** spies on `process.stdout.write`, `process.stderr.write`, `console.log`, `console.info`, `console.warn`, `console.error`, `console.debug`
- **WHEN** parses run that pass, fail, time out, abort, hit a provider error and use throwing hooks
- **THEN** none of the spies was called

### Requirement: Multi-group and node parses

When a parse plans several requests, every request SHALL carry its own `requestId`,
`requestIndex` and `ruleIds` and its own terminal event; when a node parse runs, events SHALL carry
`entry: "node"` and the node `path`.

#### Scenario: Two groups, two request events

- **GIVEN** rules on `fullName` (context `{ audience: "a" }`) and `bio` (context `{ audience: "b" }`)
- **WHEN** parsed
- **THEN** `onRequest` fired twice with the same `parseId`, `requestCount: 2`, `requestIndex` `0` and `1`, distinct `requestId`, and `ruleIds` `["fullName"]` and `["bio"]`

#### Scenario: One group fails, the other succeeds

- **GIVEN** the two-group setup and a hand-written provider that throws `EDcheckProviderError` when `state.context.audience === "b"`
- **WHEN** parsed under `open`
- **THEN** `onResponse` fired once for `requestIndex 0` and `onError` once for `requestIndex 1`, and the result has one `semantic_unavailable` warning on `bio`

#### Scenario: Node parse entry

- **GIVEN** `node-validation` applied and `node("fullName")`
- **WHEN** `node.safeParse("Ada")` runs
- **THEN** the request event has `entry: "node"` and `path: ["fullName"]`

#### Scenario: Node parse has its own parseId

- **WHEN** `safeParse(validData)` and `node("fullName").safeParse("Ada")` run
- **THEN** their events have different `parseId`

### Requirement: Observability type contract

The package SHALL export the types `EDcheckHooks`, `ProviderRequestEvent`,
`ProviderResponseEvent`, `ProviderErrorEvent` and `ProviderErrorKind`, and `EDcheckOptions.hooks`
SHALL be typed as `EDcheckHooks`.

#### Scenario: Event fields are typed

- **WHEN** `hooks.onResponse = (e) => { e.outcomes.fullName; e.response.usage?.inputTokens; e.durationMs }` is type-checked
- **THEN** `e.outcomes` is `Readonly<Record<string, "pass" | "warning" | "fail">>` and `e.durationMs` is `number`

#### Scenario: Error is unknown with a kind

- **WHEN** `hooks.onError = (e) => e.error.message` is type-checked
- **THEN** it fails to compile; `e.kind` is `"provider" | "abort" | "unexpected"`

#### Scenario: Async hooks are accepted

- **WHEN** `hooks.onRequest = async () => {}` is type-checked
- **THEN** it compiles

#### Scenario: Unknown hook key rejected

- **WHEN** `createEDcheck({ provider, hooks: { onDone: () => {} } })` is type-checked
- **THEN** it requires `@ts-expect-error`

#### Scenario: Public surface unchanged

- **WHEN** `Object.keys(await import("edcheck"))` is sorted
- **THEN** it equals the list asserted before this change
