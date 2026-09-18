Every task ends with `yarn verify` green. Red tasks write failing tests for the listed spec
scenarios and stop; green tasks make them pass with the minimum code that respects `design.md`.
Requires `bootstrap-mvp` applied. Group 7 runs only when `context-inheritance` (multi-group) and/or
`node-validation` (node entry) are applied. Scenario names refer to `specs/observability/spec.md`.
All behavior tests go through the public entry with `mockProvider`; hand-written providers are used
only where the spec says so and remain the provider boundary. Emission code goes into the function
that owns the request-execution step at apply time (`run-safe-parse`, or `run-rules` if
`node-validation` is already applied).

## 1. Types and registration

- [x] 1.1 Red — `test/types/observability.test-d.ts` with `Observability type contract`
      scenarios: "Event fields are typed", "Error is unknown with a kind", "Async hooks are
      accepted", "Unknown hook key rejected". `test/api/observability.test.ts` with `Hook
registration` scenarios: "Hooks are optional", "Non-function hook", "Unknown hook key",
      "Null hooks" ("Partial registration" waits for group 3). Extend
      `test/api/public-surface.test.ts` comment for "Public surface unchanged".
- [x] 1.2 Green — `src/api/types/{edcheck-hooks,provider-event-base,provider-request-event,provider-response-event,provider-error-event,provider-error-kind}.ts`;
      `EDcheckOptions.hooks?: EDcheckHooks`; `src/api/validate-hooks.ts` called from
      `create-edcheck`. Export the five types from `index.ts`.

## 2. Safe invocation and ids (stable internal logic)

- [x] 2.1 Red — `test/shared/create-id.test.ts`: returns a UUID v4-shaped string; 1 000 calls
      are unique. `test/api/invoke-hook.test.ts` (allowed as a direct unit test: pure and
      stable): undefined hook is a no-op; sync throw swallowed; rejected promise gets a handler
      (no `unhandledRejection` after a macrotask); return value ignored; the event object is
      passed by reference.
- [x] 2.2 Green — `src/shared/create-id.ts` (`globalThis.crypto.randomUUID()`),
      `src/api/invoke-hook.ts`.

## 3. Request and response events

- [x] 3.1 Red — extend `test/api/observability.test.ts` with `Request events` scenarios: "One
      request event per parse with uniform context", "Request object identity", "Fires before the
      provider is called", "Provider name and ids", "Distinct parses have distinct parseIds",
      "Synchronous provider throw still fires onRequest"; `Response events` scenarios: "Response
      event content", "Fail outcome is reported", "Usage is carried", "Duration reflects provider
      latency", "Fires before the parse settles", "Exactly one terminal event per request";
      `Hook registration` "Partial registration".
- [x] 3.2 Green — in the request-execution step: generate `parseId` once per parse and
      `requestId` per group; build the base event; `invokeHook(onRequest)` synchronously before
      `provider.evaluate`; after outcome mapping `invokeHook(onResponse)` with `outcomes` and
      `durationMs` (`performance.now()`). Wrap a synchronous `evaluate` throw into the same
      rejection path.

## 4. Error events

- [x] 4.1 Red — extend with `Error events` scenarios: "Provider error", "Timeout", "Malformed
      response", "Caller abort", "Unexpected error", "Error event fires before rejection
      settles", "Under closed policy the event is identical".
- [x] 4.2 Green — on rejection classify: caller signal aborted → build the `EDcheckAbortError`
      first, emit `kind: "abort"` with that instance, then reject with it;
      `EDcheckProviderError` → `kind: "provider"`, then failure policy; else `kind: "unexpected"`,
      then rethrow. Contract-validation failure of a response is routed through the
      `malformed_response` provider error before emission.

## 5. Zero-request parses and isolation

- [x] 5.1 Red — extend with `Zero-request parses fire nothing` scenarios: "Root shape failure",
      "All rules excluded by shape", "Nullish-only values", "Pre-aborted signal"; `Hook isolation`
      scenarios: "Throwing onRequest", "Throwing onResponse", "Throwing onError", "Rejected hook
      promise", "Never-settling hook promise", "Hook return value is ignored", "Hook cannot
      swallow the abort".
- [x] 5.2 Green — expected to pass through `invoke-hook`; fix any emission placed before the
      zero-request early return.

## 6. No output

- [x] 6.1 Red — `test/api/no-output.test.ts` with `No output by default` "Silent across
      outcomes": `vi.spyOn` on `process.stdout.write`, `process.stderr.write` and the five
      `console` methods; run the six parse variants; assert zero calls; restore spies.
- [x] 6.2 Green — expected to pass; remove any stray output if found.

## 7. Multi-group and node parses (conditional)

- [x] 7.1 Red — extend with `Multi-group and node parses` scenarios: "Two groups, two request
      events", "One group fails, the other succeeds" (need `context-inheritance`); "Node parse
      entry", "Node parse has its own parseId" (need `node-validation`).
- [x] 7.2 Green — `run-rules` (or the group loop) stamps `requestIndex`/`requestCount` per group
      and receives `entry`/`path` from its caller; node parse passes `entry: "node"` and its path.

## 8. Docs and roadmap

- [x] 8.1 Red — none.
- [x] 8.2 Green — README section "Observability": event fields table, OpenTelemetry-style span
      example keyed by `requestId`, aggregation by `parseId`/`requestCount`, isolation guarantee
      ("EDcheck will not tell you a hook threw"), redaction pattern. Mark `observability-hooks`
      archived in `openspec/roadmap.md` on archive.
