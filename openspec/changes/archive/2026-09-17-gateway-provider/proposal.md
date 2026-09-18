## Why

Constitution §4.9 promises two routes to Jev: a TypeSafe key or a Vercel AI Gateway key.
`bootstrap-mvp` ships only the direct adapter. Vercel users want Gateway for billing, observability
and OIDC-based auth without a second secret. §7 fixes the constraint that makes this change
non-trivial: a TypeSafe-direct user MUST NOT pull in `ai`. This change adds the Gateway adapter
behind the existing `SemanticProvider` contract with `ai` and `@ai-sdk/gateway` as optional peer
dependencies loaded lazily, plus environment-based key detection with an explicit precedence.

## What Changes

- `gatewayProvider({ apiKey?, model?, baseUrl?, maxRetries?, fetch? })` returns a
  `SemanticProvider` named `"gateway"`. `model` is a Gateway model id (default `"typesafe-ai/jev"`)
  or an AI SDK evaluation model instance. With a string model, `createGateway({ apiKey, baseURL, fetch })`
  from `@ai-sdk/gateway` builds the model; omitting `apiKey` lets the Gateway resolve
  `AI_GATEWAY_API_KEY` or Vercel OIDC itself.
- `ai` and `@ai-sdk/gateway` are imported with dynamic `import()` on first `evaluate` and marked
  external in the build. Missing modules reject with `EDcheckConfigError` code
  `missing_peer_dependency`, which `safeParse` rethrows (never turned into `semantic_unavailable`).
- Normalization: Noul question → Gateway `boolean` question; `{ type: "boolean", probability }` →
  `{ type: "noul", noul }`. `usage.{inputTokens,outputTokens}` → `SemanticUsage`. If `score-rules`
  is applied: Score questions pass through; `probabilities` map → array; `confidence` read from
  `providerMetadata.typesafe.confidence[<id>]`.
- Error mapping to `EDcheckProviderError`: `APICallError` with status → `http` (`retryable` from
  the SDK); without status → `network`; `InvalidResponseDataError` or contract validation failure →
  `malformed_response`; other SDK errors → new code `sdk`. Unsupported question type for the model
  → `EDcheckConfigError` `unsupported_question_type` (rethrown). Abort → the signal's reason.
  Retries are delegated to the SDK (`maxRetries`, default `2`); the adapter adds none.
- `providerFromEnv({ env?, prefer? })` returns `typesafeProvider` when `TYPESAFE_API_KEY` is set,
  `gatewayProvider` when `AI_GATEWAY_API_KEY` is set; both set → `prefer` decides, default
  `"typesafe"`; neither → `EDcheckConfigError` `missing_api_key`. Empty strings count as unset.
- Timeout and provider failure under `open`/`closed` behave exactly as with the direct adapter.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `provider`: ADDED requirements for the Gateway adapter (construction and lazy dependency,
  request/response normalization, Score normalization, error mapping, policy parity), key detection
  and the package contract for optional peers.

## Impact

- **Public API — runtime symbols:** `gatewayProvider`, `providerFromEnv`. Public-surface list
  updated.
- **Public API — types:** `GatewayProviderOptions`, `ProviderFromEnvOptions`, `ProviderPreference`;
  `EDcheckProviderError.code` gains `"sdk"`.
- **package.json:** `peerDependencies` gain `ai` (`>=7.0.105 <8`) and `@ai-sdk/gateway`
  (`>=4.0.85 <5`), both `optional: true` in `peerDependenciesMeta`; `devDependencies` gain the same
  two packages for typecheck and tests. `dependencies` stays undefined. `tsup` externals gain both.
- **Modules:** `providers/gateway/` (adapter, lazy loader, normalizers, error mapper),
  `providers/provider-from-env.ts`. `index.ts` re-exports the two new symbols. No other module
  changes.
- **Tests:** adapter behavior through the SDK's own `Experimental_EvaluationMockModelV4` from
  `ai/test` (the provider boundary; no network); the string-model path with an injected `fetch`
  asserting only the Authorization header and base URL; policy parity through `safeParse`; static
  import-boundary check that `src/providers/gateway/**` has no static value import from `ai`;
  package-contract assertions; key detection with an injected `env`.
- **Docs:** README "Providers" section (direct vs Gateway, install commands, `providerFromEnv`).
  `.env.example` already lists both keys.
- **Interaction with `score-rules` (independent):** the Score normalization task group runs only
  when `score-rules` is applied.
- **Not in this change:** OIDC handling beyond delegating to the Gateway SDK, Gateway
  `providerOptions`/headers passthrough, Choice, non-TypeSafe evaluation models (they are accepted
  as model instances but not tested or documented as supported).
