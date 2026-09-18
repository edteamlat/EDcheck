## Why

Every semantic parse costs tokens and latency, and its outcome is probabilistic. Teams need to see
what was sent, how long it took, what it cost and what came back, without EDcheck ever writing to
stdout/stderr on its own (constitution §9 "No logging by default"). Today the only window is
`mockProvider().calls`, which does not exist in production. This change adds three instance-level
callbacks, `onRequest` / `onResponse` / `onError`, fired exactly once per provider request with
duration, model, usage, outcomes and correlation ids, and guarantees that a misbehaving hook can
never alter a validation result.

## What Changes

- `createEDcheck({ hooks: { onRequest?, onResponse?, onError? } })`. Each hook receives one event
  per provider request (one per context group). Events share a `parseId` per `safeParse` call and
  carry `requestId`, `requestIndex`, `requestCount`, `provider`, `entry` (`"object"` or `"node"`),
  `path` (node parses), `ruleIds` and `timestamp`.
- `onRequest` fires synchronously just before `provider.evaluate` with the compiled
  `SemanticRequest`. `onResponse` fires after outcome mapping with the `SemanticResponse`,
  `outcomes` per rule and `durationMs`. `onError` fires with `kind` (`"provider"`, `"abort"`,
  `"unexpected"`), the error and `durationMs`. Exactly one of `onResponse`/`onError` follows every
  `onRequest`; a parse that makes no request (shape failure, no surviving rules, pre-aborted
  signal) fires nothing.
- Hooks are isolated: a throwing hook or a rejected hook promise is swallowed, never awaited,
  never logged, and the parse result is unchanged. Hook return values are ignored.
- Hook option validation at `createEDcheck`: non-function values and unknown keys →
  `EDcheckConfigError` `invalid_option`.
- A runtime test asserts that no parse, with or without hooks, writes to `process.stdout`,
  `process.stderr` or `console`.

## Capabilities

### New Capabilities

- `observability`: hook registration and validation, event model and correlation, exactly-once
  firing, error events for provider failure / timeout / abort / unexpected errors, hook isolation,
  no-output guarantee, type contract.

### Modified Capabilities

None. `Issue`, `SemanticResult`, payloads and the provider contract are untouched.

## Impact

- **Public API — runtime symbols:** none.
- **Public API — types:** `EDcheckHooks`, `ProviderRequestEvent`, `ProviderResponseEvent`,
  `ProviderErrorEvent`, `ProviderErrorKind`; `EDcheckOptions.hooks`.
- **Modules:** `api/` gains `validate-hooks`, `invoke-hook` and the event types; `shared/` gains
  `create-id` (`crypto.randomUUID`). Hook emission lives in the request-execution step of the
  orchestrator (`run-safe-parse`, or `run-rules` once `node-validation` is applied).
- **Tests:** `test/api/observability.test.ts` through the public entry with `mockProvider`
  (delays, errors, multi-group via `context-inheritance` when applied); type tests in
  `test/types/observability.test-d.ts`; no-output test with `vi.spyOn` on `process.stdout.write`,
  `process.stderr.write` and `console` methods.
- **Docs:** README section "Observability" with an OpenTelemetry-style example (span per
  `requestId`, attributes from the event) and the isolation guarantee.
- **Depends on:** `bootstrap-mvp`. Multi-group scenarios need `context-inheritance`; node-entry
  scenarios need `node-validation`; both groups are conditional.
- **Not in this change:** `requestId` on `Issue.provider`, aggregate per-parse hook, per-schema or
  per-call hooks, redaction of `state` in events, retry-level events inside adapters, cache.
