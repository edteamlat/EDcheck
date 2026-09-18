Every task ends with `yarn verify` green. Red tasks write failing tests for the listed spec
scenarios and stop; green tasks make them pass with the minimum code that respects `design.md`.
Requires `bootstrap-mvp` applied. Independent of the other proposed changes; group 7 runs only when
`score-rules` is applied. Scenario names refer to `specs/provider/spec.md`. Tests use
`Experimental_EvaluationMockModelV4` from `ai/test` as the provider boundary; no HTTP except the
two `fetch`-recording scenarios.

## 1. Package contract and dev dependencies

- [ ] 1.1 Red — extend `test/package-contract.test.ts` with `Optional peer package contract`
      scenarios "Peer ranges and optional flags", "Still no runtime dependencies", "Build marks
      the SDK external" (skip when `dist/` is absent, same pattern as the bootstrap build check).
      Add `test/providers/import-boundaries.test.ts` for "No static value import of the SDK"
      (scan `src/**/*.ts`, regex on `^import\s+(?!type\b)[^;]*from\s+["'](ai|ai/test|@ai-sdk/gateway)["']`).
- [ ] 1.2 Green — `yarn add -D ai@^7.0.105 @ai-sdk/gateway@^4.0.85`; add both to
      `peerDependencies` with `peerDependenciesMeta.optional: true`; add both to `tsup`
      `external`. Verify `yarn build` output contains only a dynamic `import("ai")`.

## 2. Errors and types

- [ ] 2.1 Red — `test/errors/edcheck-errors.test.ts`: `EDcheckProviderError("sdk", { cause })`
      keeps `code: "sdk"`, `retryable: false`, `cause`; `EDcheckConfigError` accepts codes
      `missing_peer_dependency`, `unsupported_question_type`, `missing_api_key`.
      `test/types/gateway-provider.test-d.ts`: `GatewayProviderOptions.model` accepts `string`
      and `Experimental_EvaluationModel`; `gatewayProvider()` returns `SemanticProvider`;
      `ProviderPreference` is `"typesafe" | "gateway"`; `providerFromEnv()` returns
      `SemanticProvider`; `@ts-expect-error` on `prefer: "other"` and on `model: 42`.
- [ ] 2.2 Green — extend the code unions in `src/errors/`; add
      `src/providers/gateway/types/gateway-provider-options.ts`,
      `src/providers/types/{provider-preference,provider-from-env-options}.ts`. `import type`
      only from `ai`.

## 3. Lazy loader and construction

- [ ] 3.1 Red — `test/providers/gateway-missing-peer.test.ts` with `Gateway adapter construction
and lazy dependency` scenarios: "Construction is synchronous and does not import the SDK",
      "SDK is imported once on first evaluate", "Model instance skips the gateway package",
      "Missing ai rejects with a config error", "Missing gateway package rejects with a config
      error", "Explicitly empty apiKey is rejected", "Omitted apiKey is accepted", "Invalid
      maxRetries is rejected". The loader receives an injected `importModule`; the provider
      factory exposes it through an internal option used only by tests (not exported from
      `index.ts`).
- [ ] 3.2 Green — `src/providers/gateway/load-ai-sdk.ts` (memoized `import("ai")` /
      `import("@ai-sdk/gateway")`, `ERR_MODULE_NOT_FOUND` and `MODULE_NOT_FOUND` →
      `missing_peer_dependency` with install hint), `src/providers/gateway/validate-gateway-options.ts`,
      `src/providers/gateway/gateway-provider.ts` skeleton returning `{ name: "gateway", evaluate }`
      where `evaluate` loads the SDK and throws "not implemented" after loading.

## 4. Model resolution and string-model path

- [ ] 4.1 Red — `test/providers/gateway-provider-http.test.ts`: "String model uses the
      configured key and base URL", "Default model id" (the recording `fetch` returns
      `new Response("{}", { status: 500 })`; assert URL prefix, `authorization` header, model id
      in the request body or URL as the Gateway SDK sends it, and `{ code: "http", status: 500 }`).
- [ ] 4.2 Green — `src/providers/gateway/resolve-evaluation-model.ts`: string →
      `createGateway({ apiKey, baseURL: baseUrl, fetch }).evaluationModel(id)` memoized per
      provider; instance → as-is. Wire into `gateway-provider.ts` with the real
      `experimental_evaluate` call and a temporary passthrough of errors (group 6 maps them);
      map `APICallError` with status to `http` now so this test passes.

## 5. Request and response normalization

- [ ] 5.1 Red — `test/providers/gateway-provider.test.ts` with `Gateway request and response
normalization` scenarios: "Noul question becomes a boolean question", "Criteria are
      optional", "Question order and ids are preserved", "Boolean answer becomes a Noul answer",
      "Usage omitted when incomplete", "Model id fallback", "Signal and maxRetries are
      forwarded", "Adapter does not retry on its own", "Missing answer is malformed", "Type
      mismatch is malformed", "Out-of-range probability is malformed".
- [ ] 5.2 Green — `src/providers/gateway/to-gateway-questions.ts`,
      `src/providers/gateway/from-gateway-answers.ts` (validate against the request's questions,
      finite `[0, 1]` probability, `usage` only when both counts are numbers, model id fallback
      chain). Reuse the response validators from the direct adapter where they already exist in
      `providers/shared` — do not duplicate range checks.

## 6. Error mapping

- [ ] 6.1 Red — extend `test/providers/gateway-provider.test.ts` with `Gateway error mapping`
      scenarios: "APICallError with status", "APICallError without status",
      "InvalidResponseDataError", "Unsupported question type", "InvalidArgumentError", "Unknown
      SDK error", "Abort is propagated", "Abort wins over error mapping". Build SDK errors with
      the real classes exported by `ai`.
- [ ] 6.2 Green — `src/providers/gateway/map-sdk-error.ts` implementing the D5 table using the
      `isInstance` statics of the loaded `ai` module; the `signal.aborted` check runs first.
      Remove the temporary passthrough from 4.2.

## 7. Score normalization (only when `score-rules` is applied)

- [ ] 7.1 Red — `test/providers/gateway-score.test.ts` with `Gateway Score normalization`
      scenarios: "Score question passes through", "Score answer is normalized", "Missing
      distribution is malformed", "Non-contiguous distribution keys are malformed", "Missing
      confidence is malformed", "Mixed Noul and Score in one request".
- [ ] 7.2 Green — extend `to-gateway-questions.ts` (passthrough) and `from-gateway-answers.ts`
      (object → array by index, `confidence` from `providerMetadata.typesafe.confidence[id]`,
      reuse `score-rules` distribution validators).

## 8. Policy parity through `safeParse`

- [ ] 8.1 Red — `test/api/gateway-policy.test.ts` with `Gateway policy parity` scenarios:
      "Provider failure under open", "Provider failure under closed", "Timeout", "Caller abort",
      "Success through the pipeline". Assert the compiled `state` received by the mock model is
      restricted to the rule path.
- [ ] 8.2 Green — expected to pass without new code; fix any adapter divergence found (for
      example abort reason propagation through the SDK).

## 9. Key detection

- [ ] 9.1 Red — `test/providers/provider-from-env.test.ts` with `Provider selection from
environment` scenarios: "TypeSafe key only", "Gateway key only", "Both keys default to
      TypeSafe", "Both keys with prefer gateway", "Prefer without matching key falls back",
      "Neither key", "Empty strings count as unset", "Key is passed through and options are
      forwarded", "Gateway options are forwarded", "Defaults to process.env" (use `vi.stubEnv`),
      "Invalid prefer".
- [ ] 9.2 Green — `src/providers/provider-from-env.ts` and its `types/`. Trim before the empty
      check. Validate `prefer` against the union (`invalid_option`).

## 10. Public surface, eval and docs

- [ ] 10.1 Red — update the sorted symbol list in `test/api/public-surface.test.ts` with
      `gatewayProvider` and `providerFromEnv` ("Public surface gains two symbols"). Add
      `test/eval/gateway-smoke.eval.test.ts` skipped without `AI_GATEWAY_API_KEY`, running the
      `full-name` fixture through `gatewayProvider()` with the direct smoke eval's tolerance bands.
- [ ] 10.2 Green — export both from `src/index.ts` (plus `GatewayProviderOptions`,
      `ProviderFromEnvOptions`, `ProviderPreference`). README "Providers" section: direct vs
      Gateway table, `yarn add ai @ai-sdk/gateway`, OIDC note, `providerFromEnv` usage and
      precedence. Mark `gateway-provider` archived in `openspec/roadmap.md` on archive.
