## ADDED Requirements

### Requirement: Gateway adapter construction and lazy dependency

`gatewayProvider({ apiKey?, model?, baseUrl?, maxRetries?, fetch? })` SHALL return a
`SemanticProvider` named `"gateway"`, validate its options synchronously, and load `ai` (and, for a
string `model`, `@ai-sdk/gateway`) with a dynamic `import()` on the first `evaluate`, memoized per
process. A failed import SHALL reject with `EDcheckConfigError` code `missing_peer_dependency`.

#### Scenario: Construction is synchronous and does not import the SDK

- **GIVEN** a loader with an injected `importModule` that records requested specifiers
- **WHEN** `gatewayProvider({ apiKey: "k" })` is called
- **THEN** it returns an object with `name: "gateway"` and a function `evaluate`, and `importModule` was not called

#### Scenario: SDK is imported once on first evaluate

- **GIVEN** the recording `importModule` resolving to the real modules
- **WHEN** `evaluate` is called twice on the same provider
- **THEN** `importModule` was called with `"ai"` exactly once

#### Scenario: Model instance skips the gateway package

- **GIVEN** `gatewayProvider({ model: new Experimental_EvaluationMockModelV4({ ... }) })`
- **WHEN** `evaluate` runs
- **THEN** `importModule` was never called with `"@ai-sdk/gateway"`

#### Scenario: Missing ai rejects with a config error

- **GIVEN** `importModule` that rejects with an error whose `code` is `"ERR_MODULE_NOT_FOUND"` for `"ai"`
- **WHEN** `evaluate` runs
- **THEN** it rejects with `EDcheckConfigError` `{ code: "missing_peer_dependency" }` whose message contains `ai` and `yarn add ai @ai-sdk/gateway`

#### Scenario: Missing gateway package rejects with a config error

- **GIVEN** `importModule` that resolves `"ai"` and rejects `"@ai-sdk/gateway"` with `ERR_MODULE_NOT_FOUND`, and a string `model`
- **WHEN** `evaluate` runs
- **THEN** it rejects with `EDcheckConfigError` `{ code: "missing_peer_dependency" }` whose message contains `@ai-sdk/gateway`

#### Scenario: Missing peer is not swallowed by the failure policy

- **GIVEN** an instance created with the provider from the previous scenario and `policy: "open"`
- **WHEN** `safeParse` runs with one attached rule and valid data
- **THEN** `safeParse` rejects with that `EDcheckConfigError`; no `semantic_unavailable` issue is produced

#### Scenario: Explicitly empty apiKey is rejected

- **WHEN** `gatewayProvider({ apiKey: "" })` and, in a separate test, `gatewayProvider({ apiKey: "   " })` are called
- **THEN** each throws `EDcheckConfigError` `{ code: "invalid_provider_options" }`

#### Scenario: Omitted apiKey is accepted

- **WHEN** `gatewayProvider({})` and `gatewayProvider()` are called
- **THEN** neither throws (Gateway resolves `AI_GATEWAY_API_KEY` or OIDC at request time)

#### Scenario: Invalid maxRetries is rejected

- **WHEN** `gatewayProvider({ maxRetries: -1 })` and, separately, `gatewayProvider({ maxRetries: 1.5 })` are called
- **THEN** each throws `EDcheckConfigError` `{ code: "invalid_provider_options" }`

#### Scenario: String model uses the configured key and base URL

- **GIVEN** `gatewayProvider({ apiKey: "gw-key", baseUrl: "https://gw.local/v1", fetch })` where `fetch` records its first call and returns a `500` response
- **WHEN** `evaluate` runs
- **THEN** the recorded URL starts with `https://gw.local/v1`, the request headers contain `authorization: Bearer gw-key`, and `evaluate` rejects with `EDcheckProviderError` `{ code: "http", status: 500 }`

#### Scenario: Default model id

- **GIVEN** the string-model path with a recording `fetch`
- **WHEN** `evaluate` runs
- **THEN** the recorded request targets model `typesafe-ai/jev`

### Requirement: Gateway request and response normalization

The Gateway adapter SHALL translate a `SemanticRequest` into an `experimental_evaluate` call and its
result into a `SemanticResponse`: Noul questions become `boolean` questions, `boolean` answers
become Noul answers, `usage` and model id are carried over, and any answer not matching its
question is `malformed_response`.

#### Scenario: Noul question becomes a boolean question

- **GIVEN** a mock model whose `doEvaluate` records its arguments
- **WHEN** the adapter evaluates `{ state: { name: "x" }, questions: { r1: { type: "noul", instructions: "i", criteria: { true: "t", false: "f" } } } }`
- **THEN** the model received `questions: { r1: { type: "boolean", instructions: "i", criteria: { true: "t", false: "f" } } }` and `state` deep-equal to the request state

#### Scenario: Criteria are optional

- **WHEN** the adapter evaluates a Noul question without `criteria`
- **THEN** the boolean question sent to the model has no `criteria` key

#### Scenario: Question order and ids are preserved

- **WHEN** the adapter evaluates questions `{ b: ..., a: ..., c: ... }`
- **THEN** `Object.keys` of the questions received by the model is `["b", "a", "c"]`

#### Scenario: Boolean answer becomes a Noul answer

- **GIVEN** a mock model returning `{ answers: { r1: { type: "boolean", probability: 0.83 } }, usage: { inputTokens: 120, outputTokens: 4 }, response: { modelId: "typesafe-ai/jev" } }`
- **WHEN** the adapter evaluates one Noul question `r1`
- **THEN** it resolves `{ model: "typesafe-ai/jev", answers: { r1: { type: "noul", noul: 0.83 } }, usage: { inputTokens: 120, outputTokens: 4 } }`

#### Scenario: Usage omitted when incomplete

- **GIVEN** a mock model returning `usage: { inputTokens: 10 }` with `outputTokens` undefined
- **WHEN** the adapter evaluates
- **THEN** the resolved response has no `usage` key

#### Scenario: Model id fallback

- **GIVEN** a mock model whose result has no `response.modelId`
- **WHEN** the adapter evaluates
- **THEN** `model` is the configured string model id or, for a model instance, `"typesafe-ai/jev"`

#### Scenario: Signal and maxRetries are forwarded

- **GIVEN** `gatewayProvider({ model: mock, maxRetries: 0 })` and a recording mock
- **WHEN** the adapter evaluates with `{ signal }`
- **THEN** the mock's call options contain `abortSignal === signal` and the SDK call was made with `maxRetries: 0`

#### Scenario: Adapter does not retry on its own

- **GIVEN** `maxRetries: 0` and a mock whose `doEvaluate` throws `APICallError` with `statusCode: 429, isRetryable: true`
- **WHEN** the adapter evaluates
- **THEN** `doEvaluate` was called exactly once and it rejects with `{ code: "http", status: 429, retryable: true }`

#### Scenario: Missing answer is malformed

- **GIVEN** a mock model whose result answers `{ r1 }` while `r1` and `r2` were asked
- **WHEN** the adapter evaluates
- **THEN** it rejects with `EDcheckProviderError` `{ code: "malformed_response" }`

#### Scenario: Type mismatch is malformed

- **GIVEN** a mock model answering `r1` with `{ type: "choice", choice: "a" }` to a Noul question
- **WHEN** the adapter evaluates
- **THEN** it rejects with `{ code: "malformed_response" }`

#### Scenario: Out-of-range probability is malformed

- **GIVEN** a mock model answering `{ type: "boolean", probability: 1.2 }` and, separately, `probability: NaN`
- **WHEN** the adapter evaluates
- **THEN** each rejects with `{ code: "malformed_response" }`

### Requirement: Gateway Score normalization

When Score rules are available, the Gateway adapter SHALL pass Score questions through unchanged,
convert the `score` answer distribution from an index-keyed object to an ordered array, and read the
confidence from `providerMetadata.typesafe.confidence[<question id>]`.

#### Scenario: Score question passes through

- **GIVEN** a recording mock model
- **WHEN** the adapter evaluates `{ q: { type: "score", instructions: "Rate", criteria: ["poor", "ok", "good"] } }`
- **THEN** the model received the same question object

#### Scenario: Score answer is normalized

- **GIVEN** a mock returning `answers: { q: { type: "score", score: 1.7, probabilities: { "0": 0.1, "1": 0.1, "2": 0.8 } } }` and `providerMetadata: { typesafe: { confidence: { q: 0.9 } } }`
- **WHEN** the adapter evaluates the three-level question `q`
- **THEN** it resolves `answers.q` deep-equal to `{ type: "score", score: 1.7, probabilities: [0.1, 0.1, 0.8], confidence: 0.9 }`

#### Scenario: Missing distribution is malformed

- **GIVEN** a mock returning a `score` answer without `probabilities`
- **WHEN** the adapter evaluates
- **THEN** it rejects with `{ code: "malformed_response" }`

#### Scenario: Non-contiguous distribution keys are malformed

- **GIVEN** `probabilities: { "0": 0.5, "2": 0.5 }` for a three-level question
- **WHEN** the adapter evaluates
- **THEN** it rejects with `{ code: "malformed_response" }`

#### Scenario: Missing confidence is malformed

- **GIVEN** a valid `score` answer and `providerMetadata` without `typesafe.confidence.q`
- **WHEN** the adapter evaluates
- **THEN** it rejects with `{ code: "malformed_response" }`

#### Scenario: Mixed Noul and Score in one request

- **GIVEN** a mock answering `n` as `boolean` and `s` as `score` with confidence
- **WHEN** the adapter evaluates `{ n, s }`
- **THEN** `answers.n.type` is `"noul"` and `answers.s.type` is `"score"`

### Requirement: Gateway error mapping

The Gateway adapter SHALL translate AI SDK failures into `EDcheckProviderError` (`http`, `network`,
`malformed_response`, `sdk`) or `EDcheckConfigError` (`unsupported_question_type`,
`invalid_provider_options`), and SHALL rethrow the signal's reason when the signal is aborted.

#### Scenario: APICallError with status

- **GIVEN** a mock model throwing `APICallError` with `statusCode: 401, isRetryable: false` and, separately, `statusCode: 503, isRetryable: true`
- **WHEN** the adapter evaluates
- **THEN** it rejects with `EDcheckProviderError` `{ code: "http", status: 401, retryable: false }` and `{ code: "http", status: 503, retryable: true }` respectively, with `cause` set to the SDK error

#### Scenario: APICallError without status

- **GIVEN** a mock model throwing `APICallError` with no `statusCode`
- **WHEN** the adapter evaluates
- **THEN** it rejects with `{ code: "network", retryable: false }`

#### Scenario: InvalidResponseDataError

- **GIVEN** a mock model throwing `InvalidResponseDataError`
- **WHEN** the adapter evaluates
- **THEN** it rejects with `{ code: "malformed_response" }`

#### Scenario: Unsupported question type

- **GIVEN** a mock model whose `supportedQuestionTypes` is `["choice"]`
- **WHEN** the adapter evaluates a Noul question
- **THEN** it rejects with `EDcheckConfigError` `{ code: "unsupported_question_type" }` and `safeParse` rethrows it under `open`

#### Scenario: InvalidArgumentError

- **GIVEN** a mock model throwing `InvalidArgumentError`
- **WHEN** the adapter evaluates
- **THEN** it rejects with `EDcheckConfigError` `{ code: "invalid_provider_options" }`

#### Scenario: Unknown SDK error

- **GIVEN** a mock model throwing `new Error("boom")`
- **WHEN** the adapter evaluates
- **THEN** it rejects with `EDcheckProviderError` `{ code: "sdk", retryable: false }` whose `cause` is the original error

#### Scenario: Abort is propagated

- **GIVEN** a mock model whose `doEvaluate` rejects with the signal's reason when aborted
- **WHEN** the signal is aborted with `new Error("stop")` while `evaluate` is pending
- **THEN** `evaluate` rejects with that same `Error("stop")`, not an `EDcheckProviderError`

#### Scenario: Abort wins over error mapping

- **GIVEN** a mock model that throws `APICallError` after the signal was aborted
- **WHEN** the adapter evaluates
- **THEN** it rejects with the signal's reason

### Requirement: Gateway policy parity

Through `safeParse`, the Gateway adapter SHALL produce the same outcomes as the direct adapter under
provider failure, timeout and cancellation.

#### Scenario: Provider failure under open

- **GIVEN** an instance with `gatewayProvider({ model })` where `model` throws `APICallError` `503`, `policy: "open"` and two attached rules
- **WHEN** `safeParse` runs
- **THEN** `success` is `true` and there are two `semantic_unavailable` warnings, one per rule path

#### Scenario: Provider failure under closed

- **GIVEN** the same with `policy: "closed"`
- **WHEN** `safeParse` runs
- **THEN** `success` is `false` and there are two `semantic_unavailable` errors

#### Scenario: Timeout

- **GIVEN** a mock model whose `doEvaluate` never resolves and rejects with the signal's reason on abort, and `timeoutMs: 20`
- **WHEN** `safeParse` runs
- **THEN** it resolves with `semantic_unavailable` issues whose `cause.code` is `"timeout"`

#### Scenario: Caller abort

- **GIVEN** the never-resolving mock and a caller `signal` aborted after 10 ms
- **WHEN** `safeParse` runs
- **THEN** it rejects with `EDcheckAbortError` and no result is emitted

#### Scenario: Success through the pipeline

- **GIVEN** a mock model answering `probability: 0.95` and a rule with default thresholds
- **WHEN** `safeParse` runs with valid data
- **THEN** `success` is `true` with no issues, and the mock received `state` restricted to the rule path

### Requirement: Provider selection from environment

`providerFromEnv({ env?, prefer?, typesafe?, gateway? })` SHALL return `typesafeProvider` when
`TYPESAFE_API_KEY` is set, `gatewayProvider` when `AI_GATEWAY_API_KEY` is set, resolve both-set by
`prefer` (default `"typesafe"`), and throw `EDcheckConfigError` code `missing_api_key` when neither is
set. Empty or whitespace-only values SHALL count as unset.

#### Scenario: TypeSafe key only

- **WHEN** `providerFromEnv({ env: { TYPESAFE_API_KEY: "t" } })` is called
- **THEN** it returns a provider with `name: "typesafe"`

#### Scenario: Gateway key only

- **WHEN** `providerFromEnv({ env: { AI_GATEWAY_API_KEY: "g" } })` is called
- **THEN** it returns a provider with `name: "gateway"`

#### Scenario: Both keys default to TypeSafe

- **WHEN** `providerFromEnv({ env: { TYPESAFE_API_KEY: "t", AI_GATEWAY_API_KEY: "g" } })` is called
- **THEN** `name` is `"typesafe"`

#### Scenario: Both keys with prefer gateway

- **WHEN** the same env with `prefer: "gateway"`
- **THEN** `name` is `"gateway"`

#### Scenario: Prefer without matching key falls back

- **WHEN** `providerFromEnv({ env: { TYPESAFE_API_KEY: "t" }, prefer: "gateway" })` is called
- **THEN** `name` is `"typesafe"`

#### Scenario: Neither key

- **WHEN** `providerFromEnv({ env: {} })` is called
- **THEN** it throws `EDcheckConfigError` `{ code: "missing_api_key" }` whose message contains both `TYPESAFE_API_KEY` and `AI_GATEWAY_API_KEY`

#### Scenario: Empty strings count as unset

- **WHEN** `providerFromEnv({ env: { TYPESAFE_API_KEY: "", AI_GATEWAY_API_KEY: "  " } })` is called
- **THEN** it throws `{ code: "missing_api_key" }`

#### Scenario: Key is passed through and options are forwarded

- **GIVEN** `env: { TYPESAFE_API_KEY: "t" }`, `typesafe: { model: "jev-1.13", fetch }` with a recording `fetch`
- **WHEN** the returned provider evaluates
- **THEN** the recorded request has `authorization: Bearer t` and body `model: "jev-1.13"`

#### Scenario: Gateway options are forwarded

- **GIVEN** `env: { AI_GATEWAY_API_KEY: "g" }`, `gateway: { baseUrl: "https://gw.local", fetch }` with a recording `fetch` returning `500`
- **WHEN** the returned provider evaluates
- **THEN** the recorded URL starts with `https://gw.local` and headers contain `authorization: Bearer g`

#### Scenario: Defaults to process.env

- **GIVEN** `process.env.TYPESAFE_API_KEY` stubbed to `"t"` for the test
- **WHEN** `providerFromEnv()` is called
- **THEN** `name` is `"typesafe"`

#### Scenario: Invalid prefer

- **WHEN** `providerFromEnv({ env: { TYPESAFE_API_KEY: "t" }, prefer: "other" as never })` is called
- **THEN** it throws `EDcheckConfigError` `{ code: "invalid_option" }`

### Requirement: Optional peer package contract

The package SHALL declare `ai` and `@ai-sdk/gateway` as optional peer dependencies, never as
`dependencies`, and SHALL NOT statically import either from any source file.

#### Scenario: Peer ranges and optional flags

- **WHEN** `package.json` is inspected
- **THEN** `peerDependencies.ai` is `">=7.0.105 <8"`, `peerDependencies["@ai-sdk/gateway"]` is `">=4.0.85 <5"`, and `peerDependenciesMeta` marks both `optional: true`

#### Scenario: Still no runtime dependencies

- **WHEN** `package.json` is inspected
- **THEN** `dependencies` is undefined

#### Scenario: No static value import of the SDK

- **WHEN** every file under `src/**` is scanned
- **THEN** no line matches a static value import from `"ai"`, `"ai/test"` or `"@ai-sdk/gateway"`; `import type` and `import(` are allowed

#### Scenario: Build marks the SDK external

- **WHEN** `dist/index.js` and `dist/index.cjs` are scanned after `yarn build`
- **THEN** neither contains the string `experimental_evaluate` as a definition, and each contains `import("ai")` at most as a dynamic import specifier

#### Scenario: Public surface gains two symbols

- **WHEN** `Object.keys(await import("edcheck"))` is sorted
- **THEN** it equals the bootstrap list plus `gatewayProvider` and `providerFromEnv`
