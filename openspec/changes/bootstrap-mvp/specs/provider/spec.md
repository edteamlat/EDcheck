## ADDED Requirements

### Requirement: SemanticProvider contract

A provider SHALL expose `name: string` and
`evaluate(request: SemanticRequest, { signal }): Promise<SemanticResponse>` returning one
`SemanticAnswer` per question id and the `model` used. The request carries no model. Providers
MUST know nothing about rules, schemas or results.

#### Scenario: Object literal satisfies the contract

- **WHEN** `const p: SemanticProvider = { name: "x", evaluate: async (req) => ({ model: "m", answers: … }) }` is type-checked
- **THEN** it compiles without error (type test)

#### Scenario: Custom provider is accepted by createEDcheck

- **GIVEN** a hand-written provider returning `noul: 0.95` for every question
- **WHEN** it is passed to `createEDcheck` and a rule is parsed
- **THEN** the result has no semantic issues and the provider received the compiled request

#### Scenario: Provider module has no forbidden imports

- **WHEN** the import graph of `src/providers/**` is inspected
- **THEN** it contains no import from `src/rules`, `src/schema`, `src/result`, `src/compiler` or `src/api`

### Requirement: Mock provider

`mockProvider(options?)` SHALL return a `MockProvider` that answers deterministically, records
every request in `calls`, honours `delayMs`, `error` and `model`, and rejects with the signal's
reason when aborted while delaying.

#### Scenario: Default answer

- **WHEN** `mockProvider()` evaluates a request with two questions
- **THEN** both answers are `{ type: "noul", noul: 0.9 }` and `model` is `"mock"`

#### Scenario: Answers by id

- **WHEN** `mockProvider({ answers: { fullName: 0.12 } })` evaluates questions `fullName` and `bio`
- **THEN** `fullName` gets `0.12` and `bio` gets the default `0.9`

#### Scenario: Answers by function

- **WHEN** `mockProvider({ answers: (question, id) => id === "bio" ? 0.5 : 1 })` evaluates
- **THEN** `bio` gets `0.5` and every other id gets `1`

#### Scenario: Calls are recorded

- **WHEN** the same mock evaluates two requests
- **THEN** `mock.calls` has length `2` and `mock.calls[0]` deep-equals the first request

#### Scenario: Injected error

- **WHEN** `mockProvider({ error: new EDcheckProviderError("http", { status: 500 }) })` evaluates
- **THEN** `evaluate` rejects with that same error instance

#### Scenario: Abort while delaying

- **GIVEN** `mockProvider({ delayMs: 500 })`
- **WHEN** the signal is aborted with reason `R` after 10 ms
- **THEN** `evaluate` rejects with `R` in well under 500 ms

#### Scenario: Custom model name

- **WHEN** `mockProvider({ model: "jev-test" })` evaluates
- **THEN** `response.model` is `"jev-test"`

### Requirement: TypeSafe adapter

`typesafeProvider({ apiKey, model?, baseUrl?, retries?, retryDelayMs?, fetch? })` SHALL call
`POST <baseUrl>/v1/systemone` with `Authorization: Bearer <apiKey>` and body
`{ state, model, questions }`, map the response to `SemanticResponse`, retry only `429`/`529` with
exponential backoff, and translate every failure into `EDcheckProviderError`.

#### Scenario: Request shape

- **GIVEN** an injected `fetch` that records its arguments and returns a valid response
- **WHEN** the adapter evaluates `{ state, questions }`
- **THEN** the URL is `https://api.typesafe.ai/v1/systemone`, method `POST`, headers include `authorization: Bearer k` and `content-type: application/json`, and the JSON body deep-equals `{ state, model: "jev-latest", questions }`

#### Scenario: Custom model and baseUrl

- **WHEN** `typesafeProvider({ apiKey: "k", model: "jev-1.13", baseUrl: "https://proxy.local" })` evaluates
- **THEN** the URL is `https://proxy.local/v1/systemone` and the body has `model: "jev-1.13"`

#### Scenario: Response mapping

- **WHEN** `fetch` returns `{ model: "jev-1.13", answers: { a: { type: "noul", noul: 0.42 } }, usage: { input_tokens: 10, output_tokens: 2 } }`
- **THEN** the adapter resolves `{ model: "jev-1.13", answers: { a: { type: "noul", noul: 0.42 } }, usage: { inputTokens: 10, outputTokens: 2 } }`

#### Scenario: Missing apiKey

- **WHEN** `typesafeProvider({ apiKey: "" })` is called
- **THEN** it throws `EDcheckConfigError` with `code: "invalid_provider_options"`

#### Scenario: Non-retryable HTTP error

- **WHEN** `fetch` returns `401` and, in separate tests, `422` and `500`
- **THEN** `evaluate` rejects with `EDcheckProviderError` `{ code: "http", status, retryable: false }` and `fetch` was called exactly once

#### Scenario: Retryable HTTP error is retried then fails

- **GIVEN** `retries: 2`, `retryDelayMs: 0` and `fetch` always returning `429`
- **WHEN** the adapter evaluates
- **THEN** `fetch` is called `3` times and it rejects with `{ code: "http", status: 429, retryable: true }`

#### Scenario: Retryable error then success

- **GIVEN** `fetch` returning `529` once and then `200`
- **WHEN** the adapter evaluates
- **THEN** it resolves with the mapped response and `fetch` was called twice

#### Scenario: Retries disabled

- **GIVEN** `retries: 0` and `fetch` returning `429`
- **WHEN** the adapter evaluates
- **THEN** `fetch` is called once and it rejects with `retryable: true`

#### Scenario: Network failure is not retried

- **WHEN** `fetch` rejects with `new TypeError("fetch failed")`
- **THEN** `evaluate` rejects with `EDcheckProviderError` `{ code: "network", retryable: false }` after one call

#### Scenario: Malformed responses

- **WHEN** `fetch` returns, in separate tests, non-JSON text, a JSON body without `answers`, an `answers` map missing one requested id, and a `noul` of `1.5`
- **THEN** each rejects with `EDcheckProviderError` `{ code: "malformed_response" }`

#### Scenario: Abort is propagated and not retried

- **GIVEN** `fetch` that rejects with the signal's reason when the signal aborts and `fetch` returning `429` first
- **WHEN** the signal is aborted before the retry delay elapses
- **THEN** `evaluate` rejects with the signal's reason, not an `EDcheckProviderError`, and `fetch` received a `signal` in its init

#### Scenario: Package pulls in neither ai nor the SDK

- **WHEN** `package.json` is inspected
- **THEN** `dependencies` is undefined or contains neither `ai` nor `@typesafe-ai/sdk`

### Requirement: Timeout enforcement

The parse orchestrator SHALL abort the provider's signal after the effective `timeoutMs` and treat
the outcome as a provider failure with `code: "timeout"`, never as a caller cancellation.

#### Scenario: Provider signal is aborted at timeout

- **GIVEN** `mockProvider({ delayMs: 500 })` and `timeoutMs: 30`
- **WHEN** `safeParse` runs
- **THEN** the signal the mock received is aborted and the parse resolves with `semantic_unavailable` issues

#### Scenario: Timeout under closed policy

- **GIVEN** the same setup with `policy: "closed"`
- **WHEN** `safeParse` runs
- **THEN** the `semantic_unavailable` issues have `severity: "error"` and `result.success` is `false`

#### Scenario: Caller abort during timeout window is still an abort

- **GIVEN** `mockProvider({ delayMs: 500 })`, `timeoutMs: 300` and a caller signal aborted at 20 ms
- **WHEN** `safeParse` runs
- **THEN** it rejects with `EDcheckAbortError`, not a timeout failure
