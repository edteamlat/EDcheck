## Context

Bootstrap D6 runs the pipeline inside `api/`: compile → combined signal → `provider.evaluate` →
policy → assembly. `context-inheritance` D5 turns "one request" into "one request per context
group", executed concurrently, each group failing independently. `node-validation` D7 extracts the
execution step into `run-rules`. Constitution §9 fixes the observability row: `onRequest` /
`onResponse` / `onError` with duration, model, usage, outcomes; no logging by default. Cost row:
usage hooks per validation, zero calls when shape fails. The `no-console` lint rule already bans
output from `src/`.

## Goals / Non-Goals

**Goals:**

- Exactly one `onRequest` and exactly one of `onResponse`/`onError` per provider request, with ids
  that correlate requests to a parse and events to each other.
- Enough data to build spans, metrics and calibration datasets without a second code path.
- A hook can never change, delay materially, or break a validation result.
- No output to stdout/stderr, ever, from the library.

**Non-Goals:**

- Aggregation (per-parse totals), sampling, redaction, exporters, retry-level events emitted by
  adapters, `requestId` on issues, per-schema/per-call hooks.

## Decisions

### D1. Instance-level registration

```ts
createEDcheck({
  provider,
  hooks: {
    onRequest: (e) => void | Promise<void>,
    onResponse: (e) => void | Promise<void>,
    onError: (e) => void | Promise<void>,
  },
});
```

- Validation at `createEDcheck`: `hooks` must be a plain object; each present key must be a
  function; unknown keys → `EDcheckConfigError` `invalid_option` (JS callers). `hooks: {}` and
  omitted `hooks` are equivalent.
- Rejected: `define(schema, { hooks })` and `safeParse(data, { hooks })`. Observability is
  process-level infrastructure; per-schema registration fragments it, per-call registration
  couples request handlers to telemetry. Both can be added additively.

### D2. Event model (`api/types/`)

```ts
type ProviderEventBase = {
  parseId: string; // one per safeParse / node safeParse call
  requestId: string; // one per provider request
  requestIndex: number; // 0-based position of the group in this parse
  requestCount: number; // groups planned for this parse
  provider: string; // provider.name
  entry: "object" | "node"; // "node" only when node-validation is applied
  path?: readonly string[]; // node path when entry === "node"
  ruleIds: readonly string[]; // question ids of this request, declaration order
  timestamp: number; // Date.now() when the request started
};
type ProviderRequestEvent = ProviderEventBase & { request: SemanticRequest };
type ProviderResponseEvent = ProviderEventBase & {
  response: SemanticResponse; // model, answers, usage
  outcomes: Readonly<Record<string, Outcome>>; // ruleId → pass | warning | fail
  durationMs: number;
};
type ProviderErrorKind = "provider" | "abort" | "unexpected";
type ProviderErrorEvent = ProviderEventBase & {
  kind: ProviderErrorKind;
  error: unknown; // EDcheckProviderError | EDcheckAbortError | anything thrown
  durationMs: number;
};
type EDcheckHooks = {
  onRequest?: (event: ProviderRequestEvent) => void | Promise<void>;
  onResponse?: (event: ProviderResponseEvent) => void | Promise<void>;
  onError?: (event: ProviderErrorEvent) => void | Promise<void>;
};
```

- `request` and `response` are the exact objects exchanged with the provider (same reference),
  not copies: zero cost, and the app owns its data. Mutating them from a hook is undefined
  behavior, documented.
- `requestCount` lets an app aggregate per parse without a fourth hook: when it has seen
  `requestCount` terminal events for a `parseId`, the parse is complete. Rejected: `onParse`
  aggregate hook — additive later if the counting pattern proves insufficient.
- `outcomes` are the policy results before severity mapping (`pass` included), because a parse
  emits no issue for `pass` and telemetry needs the full distribution.
- `kind` gives narrowing without importing error classes; `error` stays `unknown` because a
  hand-written provider can throw anything. Mapping: `EDcheckAbortError` → `"abort"`;
  `EDcheckProviderError` (including `timeout`) → `"provider"`; else `"unexpected"`.
- Names are prefixed `Provider…` to avoid the DOM `ErrorEvent` global.
- Ids: `crypto.randomUUID()` (`shared/create-id.ts`, Node ≥ 20 global). Rejected: counters —
  not unique across processes; the app correlates across services.

### D3. Firing rules (normative)

Inside the request-execution step, for each planned group `i` of `n`:

1. `timestamp = Date.now()`, `start = performance.now()`, `requestId = createId()`.
2. `invokeHook(onRequest, event)` **synchronously**, before `provider.evaluate` is called. Hence
   in tests `onRequest` events precede `mock.calls` entries and, for a mock that throws
   synchronously, `onRequest` still fires.
3. `await provider.evaluate(request, { signal })`.
4. On fulfilment and contract-valid response: map outcomes, then `invokeHook(onResponse, …)` with
   `durationMs = performance.now() - start`, then continue to assembly.
5. On rejection: if the caller signal is aborted → `onError` with `kind: "abort"` and the
   `EDcheckAbortError` that `safeParse` will reject with (same object). Else if
   `EDcheckProviderError` → `kind: "provider"` (timeout included; `error.code === "timeout"`),
   then the failure policy. Else → `kind: "unexpected"`, then rethrow (bootstrap: non-provider
   errors are rethrown).
6. A response failing contract validation inside the orchestrator is a `malformed_response`
   provider error → `onError`, never `onResponse`.

Guarantees: for every request exactly one `onRequest` and exactly one terminal event; terminal
events fire before the parse promise settles; groups fire independently and concurrently, so
`requestIndex` identifies them and event order across groups is not guaranteed. A parse with zero
planned requests (shape failure at root, all rules excluded or nullish, pre-aborted signal) fires
nothing — consistent with "zero calls when shape fails".

Rejected: firing `onError` for a pre-aborted parse. There is no request to describe; the caller
already receives `EDcheckAbortError`.

### D4. Hook isolation (`api/invoke-hook.ts`)

```ts
function invokeHook<E>(hook: ((e: E) => void | Promise<void>) | undefined, event: E): void {
  if (!hook) return;
  try {
    const out = hook(event);
    if (out && typeof (out as Promise<void>).then === "function") {
      (out as Promise<void>).then(undefined, () => undefined);
    }
  } catch {
    /* swallowed by contract */
  }
}
```

- Synchronous throws are caught; promise rejections get a no-op handler so no
  `unhandledRejection` fires. The hook's return value is never awaited: the parse latency does not
  depend on telemetry backends.
- Swallowed silently: any other behavior would either log (forbidden) or turn telemetry bugs into
  validation failures. README: "test your hooks; EDcheck will not tell you they threw."
- Rejected: `onHookError` meta-hook. More surface for a rare case; the app can wrap its own hooks.

### D5. Node parses and multi-group parses

- With `node-validation` applied, `run-rules` receives `entry` and `path` from its caller and
  stamps them on every event; otherwise `entry` is always `"object"` and `path` is absent.
- With `context-inheritance` applied, `requestCount > 1` occurs when rule contexts differ; each
  group has its own `requestId`, `requestIndex`, `ruleIds` and terminal event. A group that fails
  produces `onError` for itself and `onResponse` for the others.

### D6. No-output guarantee

Beyond the `no-console` lint rule, a runtime test spies on `process.stdout.write`,
`process.stderr.write`, `console.log/info/warn/error/debug` for the duration of parses that
succeed, fail, time out, abort and have throwing hooks, and asserts zero calls. Rejected: relying
on lint alone — it does not cover `process.stdout.write` or dependencies.

### D7. Modules

| Module    | Files (one exported symbol each)                                                                                                                                                                                |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/`    | `validate-hooks`, `invoke-hook`, `types/edcheck-hooks`, `types/provider-event-base`, `types/provider-request-event`, `types/provider-response-event`, `types/provider-error-event`, `types/provider-error-kind` |
| `shared/` | `create-id`                                                                                                                                                                                                     |

`EDcheckOptions` gains `hooks?: EDcheckHooks`. `index.ts` exports the five types. Nothing in
`providers/`, `compiler/`, `policy/`, `result/` changes.

### D8. Test strategy

- **Public entry** (`test/api/observability.test.ts`): hooks push events into arrays; assertions
  on counts, ordering relative to `mock.calls`, ids (`parseId` shared, `requestId` unique and
  UUID-shaped), `requestIndex`/`requestCount`, `ruleIds`, `provider`, `entry`, `request` and
  `response` identity with `mock.calls[i]` / mock output, `outcomes` for pass/warning/fail,
  `durationMs` bounds with `delayMs`, `timestamp` within the test window.
- **Error events:** `mockProvider({ error })` → `kind: "provider"`; `delayMs` + `timeoutMs` →
  `kind: "provider"` with `error.code === "timeout"`; caller abort → `kind: "abort"` with the same
  `EDcheckAbortError` instance the parse rejects with; hand-written provider throwing
  `new Error("x")` → `kind: "unexpected"` and the parse rejects; malformed mock response (function
  answer returning `2`) → `kind: "provider"`, `error.code === "malformed_response"`.
- **Zero-request parses:** root shape failure, all rules excluded, nullish-only, pre-aborted →
  no events.
- **Isolation:** throwing `onRequest`/`onResponse`/`onError`; hook returning a rejected promise;
  hook returning a never-settling promise (parse still resolves promptly); result deep-equals the
  no-hooks result; no `unhandledRejection`.
- **Validation:** non-function hook, unknown key, `hooks: null` → `invalid_option`; `hooks: {}`
  fine.
- **Conditional groups:** multi-group (requires `context-inheritance`), node entry (requires
  `node-validation`).
- **No-output** test per D6.
- **Type tests** (`test/types/observability.test-d.ts`): event shapes; `error: unknown`;
  `hooks.onRequest` return `void | Promise<void>`; `@ts-expect-error` on an unknown hook key and
  on a hook with a wrong parameter type; the five types exported.
- Provider mock only; the hand-written provider for `"unexpected"` is still the provider boundary.

## Risks / Trade-offs

- [Same-reference `request`/`response` in events] → documented as read-only; cheaper and lets
  apps compare identity with their own instrumentation.
- [Events carry user values] → server-side, app-owned data; redaction is an app concern and a
  documented pattern (strip `state` before export).
- [Concurrent groups interleave events] → `requestIndex`/`requestId` are the correlation keys;
  tests never assume cross-group order.
- [Silent hook failures hide telemetry bugs] → documented; README suggests wrapping hooks with the
  app's own error reporter.
- [`crypto.randomUUID` availability] → Node ≥ 20 is already required (native `fetch`).

## Migration Plan

Additive. No hooks registered → no behavioral change; the extra work is one `Date.now()` and one
`performance.now()` pair per request.

## Open Questions

None.
