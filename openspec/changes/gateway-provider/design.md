## Context

Bootstrap defines `SemanticProvider.evaluate(request, { signal })` and ships `typesafeProvider`
(native `fetch`, own bounded retries) and `mockProvider`. Constitution §7: Gateway model
`typesafe-ai/jev`, AI SDK ≥ 7.0.105, `experimental_evaluate`; Noul appears as `boolean`;
confidence under `providerMetadata.typesafe`; a TypeSafe-direct user MUST NOT pull in `ai`.

Verified against Vercel and AI SDK docs on 2026-09-17:

- `ai@7.0.105` (deps: `@ai-sdk/gateway@4.0.85`, `@ai-sdk/provider`, `@ai-sdk/provider-utils`).
- `experimental_evaluate({ model, state, questions, abortSignal?, maxRetries?, headers?, providerOptions? })`
  → `{ answers, usage: { inputTokens?, outputTokens?, totalTokens? }, warnings, providerMetadata, response, rounding }`.
- Questions: `boolean` (`criteria?: { true?, false? }`), `choice`, `score` (`criteria: string[]`, ≥ 2).
  Answers keep the question id and type: `boolean` → `{ probability }` (required); `score` →
  `{ score, probabilities?: { "<i>": p } }` (distribution optional in the SDK contract, present for
  TypeSafe). TypeSafe confidence: `result.providerMetadata?.typesafe?.confidence[<id>]`.
- A string model resolves through Vercel AI Gateway using `AI_GATEWAY_API_KEY` or OIDC. An explicit
  key requires `createGateway({ apiKey })` from `@ai-sdk/gateway` and `gateway.evaluationModel(id)`.
- Errors: `APICallError` (`statusCode`, `isRetryable`), `InvalidResponseDataError`,
  `Experimental_EvaluationUnsupportedQuestionTypeError`, `InvalidArgumentError`; the SDK retries
  transient failures (`maxRetries: 2` default) and honours `abortSignal`. `ai/test` exports
  `Experimental_EvaluationMockModelV4`.

## Goals / Non-Goals

**Goals:**

- Gateway route behind the unchanged `SemanticProvider` contract; the orchestrator does not know
  which adapter it talks to.
- Zero cost for TypeSafe-direct users: no `ai` in `dependencies`, no static import of `ai`, build
  output references it only as an external dynamic import.
- Identical failure semantics (`open`/`closed`, timeout, abort) across adapters.
- Explicit, testable key detection.

**Non-Goals:**

- Re-implementing the Gateway wire protocol with `fetch`. The SDK owns it.
- Retry policy on top of the SDK's.
- Non-TypeSafe evaluation models as a supported feature; Choice questions.
- Loading `.env` files.

## Decisions

### D1. Optional peer dependencies, loaded lazily

- `package.json`: `peerDependencies.ai: ">=7.0.105 <8"`, `peerDependencies["@ai-sdk/gateway"]: ">=4.0.85 <5"`,
  both `optional: true` in `peerDependenciesMeta`. Same two packages in `devDependencies`
  (typecheck, tests). `tsup` `external` gains both.
- `providers/gateway/load-ai-sdk.ts` does `await import("ai")` and, only for the string-model
  path, `await import("@ai-sdk/gateway")`, memoized per process. Types come from
  `import type` only, which erases at build.
- A failed import rejects with `EDcheckConfigError` code `missing_peer_dependency` naming the
  package and the install command. The orchestrator already rethrows non-`EDcheckProviderError`
  errors, so a misconfigured deployment fails loudly instead of degrading to
  `semantic_unavailable`.
- Rejected: a separate package `edcheck-gateway`. Single-entry rule (§3, package-contract test);
  the lazy import gives the same isolation.
- Rejected: eager import at `gatewayProvider()` construction. It would make the factory async or
  force a top-level await; lazy-on-first-evaluate plus memoization is simpler and fails on the
  first parse, which is the first moment the app would notice anyway.
- Rejected: `require`. ESM-only dynamic `import()` works in both build formats (`tsup` emits it
  as-is for externals in CJS output too).

### D2. Options and model resolution

```ts
type GatewayProviderOptions = {
  apiKey?: string; // omitted → Gateway resolves AI_GATEWAY_API_KEY / OIDC
  model?: string | Experimental_EvaluationModel; // default "typesafe-ai/jev"
  baseUrl?: string; // forwarded to createGateway as baseURL
  maxRetries?: number; // forwarded to experimental_evaluate, default 2
  fetch?: typeof fetch; // forwarded to createGateway (tests, proxies)
};
```

- String model → `createGateway({ apiKey, baseURL: baseUrl, fetch }).evaluationModel(model)`, memoized.
- Model instance → used directly; `@ai-sdk/gateway` is never imported. This is also the test
  seam: `Experimental_EvaluationMockModelV4` from `ai/test` is the provider boundary.
- `apiKey: ""` → `EDcheckConfigError` `invalid_provider_options` (explicitly empty is a bug;
  omitted is a choice). `maxRetries < 0` or non-integer → `invalid_provider_options`.
- `name` is `"gateway"`.
- Rejected: requiring `apiKey`. Breaks OIDC on Vercel, the main reason to use Gateway.

### D3. Request normalization

| Contract question                                              | Gateway question                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `{ type: "noul", instructions, criteria? }`                    | `{ type: "boolean", instructions, criteria? }` (same keys `true`/`false`) |
| `{ type: "score", instructions, criteria }` (if `score-rules`) | unchanged                                                                 |

`state` is passed as-is (object). Question ids are preserved. `abortSignal` = the orchestrator's
combined signal. `maxRetries` forwarded.

### D4. Response normalization

- `boolean` answer → `{ type: "noul", noul: probability }`.
- `score` answer (if `score-rules`) → `{ type: "score", score, probabilities: array, confidence }`
  where the array is built from keys `"0"…"n-1"` (n = question `criteria.length`) and
  `confidence = providerMetadata.typesafe.confidence[id]`. Missing distribution, non-contiguous
  keys, missing or out-of-range confidence → `malformed_response`.
- An answer id missing or with a type not matching its question → `malformed_response` (the SDK
  already rejects these with `InvalidResponseDataError`; the adapter re-checks against the contract).
- `usage` → `{ inputTokens, outputTokens }` when both are numbers; omitted otherwise.
- `model` → `result.response?.modelId` when present, else the string model id, else
  `"typesafe-ai/jev"`.

### D5. Error mapping (`providers/gateway/map-sdk-error.ts`)

Checked in this order, using `isInstance` statics from the dynamically imported `ai` module:

| Condition                                                 | Result                                                               |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| `signal.aborted`                                          | rethrow `signal.reason` (orchestrator decides abort vs timeout)      |
| `Experimental_EvaluationUnsupportedQuestionTypeError`     | `EDcheckConfigError` `unsupported_question_type` (rethrown by parse) |
| `InvalidArgumentError`                                    | `EDcheckConfigError` `invalid_provider_options`                      |
| `APICallError` with `statusCode`                          | `EDcheckProviderError` `http`, `status`, `retryable = isRetryable`   |
| `APICallError` without `statusCode`                       | `EDcheckProviderError` `network`, `retryable: false`                 |
| `InvalidResponseDataError` or contract validation failure | `EDcheckProviderError` `malformed_response`                          |
| anything else                                             | `EDcheckProviderError` `sdk`, `retryable: false`, `cause`            |

`EDcheckProviderError.code` gains `"sdk"`. Timeouts are produced by the orchestrator's combined
signal exactly as for the direct adapter; the adapter never measures time itself.

### D6. Key detection: `providerFromEnv`

```ts
type ProviderPreference = "typesafe" | "gateway";
type ProviderFromEnvOptions = {
  env?: Record<string, string | undefined>; // default process.env
  prefer?: ProviderPreference; // default "typesafe"
  typesafe?: Omit<TypesafeProviderOptions, "apiKey">;
  gateway?: Omit<GatewayProviderOptions, "apiKey">;
};
```

- `TYPESAFE_API_KEY` set (non-empty after trim) → `typesafeProvider({ apiKey, ...typesafe })`.
- `AI_GATEWAY_API_KEY` set → `gatewayProvider({ apiKey, ...gateway })`.
- Both → `prefer`. Default `"typesafe"`: zero optional peers, one hop, and the more specific key.
- Neither → `EDcheckConfigError` `missing_api_key` listing both variable names.
- Rejected: auto-detection inside `createEDcheck` when `provider` is omitted. Bootstrap fixed
  "missing provider → `invalid_option`"; implicit env reads inside the core factory hide
  configuration. An explicit helper keeps the instance honest.
- Rejected: preferring Gateway when both are set. Choosing the route that needs no optional peer
  cannot fail with `missing_peer_dependency`.

### D7. Modules

| Module               | Files (one exported symbol each)                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `providers/gateway/` | `gateway-provider`, `load-ai-sdk`, `resolve-evaluation-model`, `to-gateway-questions`, `from-gateway-answers`, `map-sdk-error`, `types/gateway-provider-options` |
| `providers/`         | `provider-from-env`, `types/provider-from-env-options`, `types/provider-preference`                                                                              |
| `errors/`            | `edcheck-provider-error` code union gains `"sdk"`                                                                                                                |
| `index.ts`           | `gatewayProvider`, `providerFromEnv` + types                                                                                                                     |

`providers/` still imports nothing from `rules/`, `schema/`, `result/`, `compiler/`, `api/`.
`provider-from-env` imports the two concrete adapters; that is inside `providers/` and `index.ts`
remains the only place outside it that knows them.

### D8. Test strategy

- **Adapter tests** (`test/providers/gateway-provider.test.ts`): `Experimental_EvaluationMockModelV4`
  as `model`, with a `doEvaluate` that records its arguments and returns canned results or throws
  SDK errors. Covers normalization both ways, usage, model id, every row of D5, abort propagation,
  `maxRetries` forwarding. This is the provider boundary; no HTTP.
- **String-model path** (`test/providers/gateway-provider-http.test.ts`): `gatewayProvider({ apiKey, baseUrl, fetch })`
  with a `fetch` that records the first call and returns a 500; asserts the URL starts with
  `baseUrl`, the `Authorization` header is `Bearer <key>`, and the error maps to `http` / `500`.
  Nothing else about the wire format is asserted.
- **Lazy dependency** (`test/providers/gateway-missing-peer.test.ts`): the loader accepts an
  injectable `importModule` (default `(s) => import(s)`), tests pass one that rejects with
  `ERR_MODULE_NOT_FOUND`; assert `missing_peer_dependency` and that `safeParse` rejects (not
  fail-open). Injecting the importer is the boundary to the module system, analogous to
  injecting `fetch`.
- **Policy parity** (`test/api/gateway-policy.test.ts`): through `safeParse` with a mock model
  throwing `APICallError(503)`: `open` → warnings, `closed` → errors; mock model that never
  resolves + `timeoutMs` → `semantic_unavailable`; caller abort → `EDcheckAbortError`.
- **Key detection** (`test/providers/provider-from-env.test.ts`): injected `env`, all four
  combinations, `prefer`, empty-string handling, option forwarding.
- **Static guards** (`test/providers/import-boundaries.test.ts`): no `import … from "ai"` /
  `from "@ai-sdk/gateway"` value import in `src/**` (only `import type` or `import(`);
  `test/package-contract.test.ts`: optional peers declared, no `dependencies`, externals include
  both.
- **Type tests** (`test/types/gateway-provider.test-d.ts`): `model` accepts string or
  `Experimental_EvaluationModel`; return type is `SemanticProvider`; `providerFromEnv` return type.
- **Eval**: `test/eval/gateway-smoke.eval.test.ts` skipped without `AI_GATEWAY_API_KEY`; runs the
  `full-name` fixture through `gatewayProvider` with the same bands as the direct smoke eval.
- **Score normalization** tests exist only if `score-rules` is applied (task group 7).

## Risks / Trade-offs

- [`experimental_evaluate` is experimental and may change in patch releases] → peer range pinned
  to `>=7.0.105 <8`; the adapter touches a small surface (`evaluate`, four error classes, mock
  model); smoke eval catches drift when a key is present.
- [Dynamic import in CJS consumers] → Node ≥ 20 supports `import()` from CJS; `tsup` keeps it as
  an external call; documented.
- [Double retries] → none: the adapter does not retry; `maxRetries` is forwarded to the SDK.
- [`missing_peer_dependency` only surfaces on first parse] → README shows the install command
  next to `gatewayProvider`; the error message includes it.
- [Gateway `probabilities` optional per SDK contract] → TypeSafe native returns it; absence is
  `malformed_response`, consistent with the direct adapter.
- [`providerFromEnv` reads `process.env` at call time] → call once at startup; documented.

## Migration Plan

Additive. Direct-adapter users install nothing new. Gateway users run
`yarn add ai @ai-sdk/gateway`. Public-surface list gains two symbols.

## Open Questions

None.
