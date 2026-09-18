## ADDED Requirements

### Requirement: Fixture format and coverage

Every file under `test/fixtures/<rule>/{es,en}.json` SHALL match the fixture schema (`rule`, `kind`,
`language`, `cases[]` with unique `id`, `expect`, `value`, optional `tags` and `note`) and SHALL
meet the coverage minimums for its kind and language.

#### Scenario: Every fixture file validates

- **WHEN** each `test/fixtures/*/{es,en}.json` is loaded with `loadFixture`
- **THEN** none throws, `rule` equals the directory name and `language` equals the file name

#### Scenario: Ids are unique and well-formed

- **WHEN** a fixture file is inspected
- **THEN** every `id` matches `^[a-z0-9-]+$` and no two cases share an `id`

#### Scenario: Expect matches the kind

- **GIVEN** a synthetic Noul file with `expect: { level: "clear" }` and a synthetic Score file with `expect: "positive"`
- **WHEN** `loadFixture` parses each
- **THEN** each throws an error whose message contains the file path and the offending `id`

#### Scenario: Noul coverage minimums

- **WHEN** a Noul fixture file is inspected
- **THEN** it has at least `6` positive, `6` negative and `2` ambiguous cases

#### Scenario: Score coverage minimums

- **WHEN** a Score fixture file is inspected
- **THEN** every level of the binding has at least `2` cases expecting it and there are at least `2` ambiguous cases

#### Scenario: Required tags per language

- **WHEN** any fixture file is inspected
- **THEN** it contains at least `2` cases tagged `adversarial`, at least `1` tagged `injection` and at least `1` tagged `rtl`

#### Scenario: Long and emoji cases per rule

- **WHEN** the `es` and `en` files of a rule are inspected together
- **THEN** at least one case is tagged `long` with a string value of `>= 2000` characters and at least one is tagged `emoji`

#### Scenario: Injection cases are negative

- **WHEN** a case is tagged `injection`
- **THEN** its `expect` is `"negative"` (Noul) or the lowest level of the binding (Score)

#### Scenario: Migrated content preserved

- **WHEN** `full-name`, `age-occupation` and `project-description` fixtures are inspected
- **THEN** `full-name` contains `"asdfasdf"` as negative, `project-description` contains a 60-repeated-character value expecting `meaningless`, and `age-occupation` contains `{ age: 7, occupation: "Senior engineer, 15 years experience" }` as negative

### Requirement: Fixture registry and payload snapshots

Each example rule SHALL have a `binding.ts` exporting a `FixtureBinding`, the registry SHALL list
every binding whose dependency is applied, and the compiled request for the first positive case of
each binding and language SHALL be snapshotted.

#### Scenario: Registry covers every fixture directory

- **WHEN** `test/fixtures/*/` directories are listed
- **THEN** each has a `binding.ts` whose `rule` equals the directory name and appears in `registry`

#### Scenario: Binding parses its own positive cases through Zod

- **WHEN** each positive case value is mapped with `toInput` and parsed by `binding.schema`
- **THEN** every parse succeeds

#### Scenario: Payload snapshot per binding and language

- **GIVEN** `mockProvider()` and `binding.define(edcheck)`
- **WHEN** the first positive case of each language is parsed
- **THEN** `mock.calls[0]` matches the stored snapshot `fixture-payloads/<rule>.<language>.json`

#### Scenario: Cross-field binding state

- **GIVEN** the `age-occupation` binding
- **WHEN** a positive case is parsed
- **THEN** `mock.calls[0].state` deep-equals `{ age: <n>, occupation: <s> }` and the single question id is `age+occupation`

#### Scenario: Context binding state

- **GIVEN** the `project-name` binding
- **WHEN** a positive case is parsed
- **THEN** `mock.calls[0].state.context` deep-equals `{ domain: "enterprise software", purpose: "Name of an internal software project" }`

### Requirement: Eval runner skip and provider selection

The eval suites SHALL be skipped without `TYPESAFE_API_KEY` or `AI_GATEWAY_API_KEY`, SHALL select
the provider from the environment, and SHALL never fail for lack of a key.

#### Scenario: Skipped without a key

- **WHEN** `vitest run test/eval --reporter=json` is spawned with both variables removed from the environment
- **THEN** the report has `numFailedTests: 0` and at least one skipped or pending test

#### Scenario: hasEvalKey

- **WHEN** `hasEvalKey(env)` is called with `{}`, `{ TYPESAFE_API_KEY: "" }`, `{ TYPESAFE_API_KEY: "t" }`, `{ AI_GATEWAY_API_KEY: "g" }`
- **THEN** it returns `false`, `false`, `true`, `true`

#### Scenario: Provider from environment

- **WHEN** `resolveEvalProvider({ TYPESAFE_API_KEY: "t" })` and `resolveEvalProvider({ AI_GATEWAY_API_KEY: "g" })` are called
- **THEN** the providers are named `"typesafe"` and `"gateway"` respectively; without `gateway-provider` applied the second throws `EDcheckConfigError` `{ code: "missing_api_key" }`

#### Scenario: Forced provider

- **WHEN** `resolveEvalProvider({ TYPESAFE_API_KEY: "t", AI_GATEWAY_API_KEY: "g", EDCHECK_EVAL_PROVIDER: "gateway" })` is called
- **THEN** the provider is named `"gateway"`

### Requirement: Eval bands and miss report

For each Noul binding and language the runner SHALL assert positives never fall below
`DEFAULT_THRESHOLDS.fail` and negatives never reach `DEFAULT_THRESHOLDS.pass`, tolerate at most one
miss, record ambiguous cases without asserting, and describe every miss with rule, language, id,
value and observed probability.

#### Scenario: One test per rule and language

- **WHEN** `noul-rules.eval.test.ts` is collected
- **THEN** it declares one `it` per Noul binding × language named `<rule> (<language>)`

#### Scenario: Positive band

- **WHEN** a positive has `probability < DEFAULT_THRESHOLDS.fail`
- **THEN** it counts as a miss

#### Scenario: Negative band

- **WHEN** a negative has `probability >= DEFAULT_THRESHOLDS.pass`
- **THEN** it counts as a miss

#### Scenario: Ambiguous is recorded only

- **WHEN** ambiguous cases yield any probability
- **THEN** they never count as misses and appear in the observations

#### Scenario: Tolerance

- **GIVEN** `countMisses` over synthetic observations
- **WHEN** a rule × language has exactly one miss and, separately, two misses
- **THEN** the first passes the tolerance check and the second fails it

#### Scenario: Miss message format

- **WHEN** `formatMiss({ rule: "full-name", language: "en", id: "neg-keyboard", expect: "negative", band: "p < 0.65", probability: 0.86, value: "asdfasdf" })` is called
- **THEN** it returns `[full-name/en/neg-keyboard] expected negative (p < 0.65), observed p=0.86 for "asdfasdf"`

#### Scenario: Long values are truncated in messages

- **WHEN** `formatMiss` receives a 300-character value
- **THEN** the message contains the first `60` characters followed by `…`

#### Scenario: Object values are serialized

- **WHEN** `formatMiss` receives `{ age: 7, occupation: "Senior engineer" }`
- **THEN** the message contains `{"age":7,"occupation":"Senior engineer"}`

#### Scenario: Provider failure counts as a miss

- **WHEN** a case's parse yields a `semantic_unavailable` issue or rejects
- **THEN** the observation records `error` with the error code and counts as one miss whose message names the case and the code

#### Scenario: Bounded concurrency

- **GIVEN** a hand-written provider that records the maximum number of in-flight requests and resolves after `10` ms
- **WHEN** `runCases` runs `12` cases with concurrency `4`
- **THEN** the recorded maximum is `<= 4` and all `12` observations are returned in fixture order

#### Scenario: Observation shape

- **WHEN** `runCases` completes a Noul case through `mockProvider({ answers: () => 0.7, model: "mock" })`
- **THEN** the observation deep-equals `{ rule, language, id, expect, probability: 0.7, model: "mock", durationMs: <number> }`

### Requirement: Score eval

For each Score binding and language the runner SHALL assert the argmax level equals `expect.level`
with at most one miss, and SHALL record `score`, `confidence` and the level in observations.

#### Scenario: Level match

- **WHEN** a case expecting `clear` yields argmax level `clear`
- **THEN** it is not a miss

#### Scenario: Level miss message

- **WHEN** `formatMiss` receives a Score miss `{ expect: { level: "clear" }, level: "vague", score: 1.2, confidence: 0.7 }`
- **THEN** the message contains `expected level "clear", observed "vague" (score=1.2, confidence=0.7)`

#### Scenario: Ambiguous Score cases recorded only

- **WHEN** an ambiguous Score case is evaluated
- **THEN** its observation carries `level`, `score` and `confidence` and it is never a miss

#### Scenario: Score observation from mock

- **WHEN** `runCases` completes a Score case through a mock answering `probabilities: [0.1, 0.1, 0.8], confidence: 0.9`
- **THEN** the observation has `level: "clear"`, `score` within `0.001` of `1.7` and `confidence: 0.9`

### Requirement: Baseline and threshold derivation

`test/eval/baseline.json` SHALL record the observations of one real run with `recordedAt`,
`provider`, `model` and `calibration`; `deriveThresholds` SHALL place `fail` and `pass` inside the
gap between the highest negative and the lowest positive on a `0.05` grid with a `0.05` margin; and
`DEFAULT_THRESHOLDS` SHALL equal the derivation over the committed baseline.

#### Scenario: Separable observations

- **WHEN** `deriveThresholds` receives negatives with max `0.31` and positives with min `0.72`
- **THEN** it returns `{ separable: true, narrowGap: false, fail: 0.4, pass: 0.65, negativeMax: 0.31, positiveMin: 0.72 }`

#### Scenario: Safety invariants hold on the input

- **WHEN** `deriveThresholds` succeeds on any separable input
- **THEN** every negative has `p < pass` and every positive has `p >= fail`

#### Scenario: Narrow gap

- **WHEN** negatives max `0.55` and positives min `0.62`
- **THEN** it returns `fail: 0.55`, `pass: 0.6`, `narrowGap: true`

#### Scenario: Overlap is reported, not resolved

- **GIVEN** negatives `[0.2, 0.7]` with ids `n1`, `n2` and positives `[0.65, 0.9]` with ids `p1`, `p2`
- **WHEN** `deriveThresholds` runs
- **THEN** it returns `{ separable: false, overlapping: ["p1", "n2"] }` with no `pass`/`fail`

#### Scenario: Grid rounding avoids float drift

- **WHEN** negatives max `0.3` and positives min `0.8`
- **THEN** `fail` is exactly `0.35` and `pass` exactly `0.75`

#### Scenario: Clamping

- **WHEN** negatives max `0.01` and positives min `0.99`
- **THEN** `fail` is `0.1` and `pass` is `0.9` (never `0` or `1`)

#### Scenario: Rates are computed

- **GIVEN** the separable input plus ambiguous probabilities `[0.5, 0.9]`
- **WHEN** derived
- **THEN** `positiveDecisiveRate` is `1`, `negativeDecisiveRate` is `1` and `ambiguousInWarningRate` is `0.5`

#### Scenario: Missing label throws

- **WHEN** `deriveThresholds` receives no negatives or no positives
- **THEN** it throws an error naming the missing label

#### Scenario: Constant matches the committed baseline

- **WHEN** `test/eval/baseline.json` is loaded and `deriveThresholds(baseline.observations)` is recomputed
- **THEN** `baseline.calibration.separable` is `true`, `baseline.calibration.pass/fail` equal the recomputed values, and `DEFAULT_THRESHOLDS` deep-equals `{ pass: baseline.calibration.pass, fail: baseline.calibration.fail }`

#### Scenario: Baseline provenance

- **WHEN** `test/eval/baseline.json` is inspected
- **THEN** `recordedAt` is an ISO-8601 date, `provider` is `"typesafe"` or `"gateway"`, `model` is a non-empty string, and there is at least one observation per registry binding and language

#### Scenario: Eval writes the baseline only when asked

- **GIVEN** `writeBaseline` with an injected file writer
- **WHEN** called with `EDCHECK_WRITE_BASELINE` unset and, separately, set to `"1"`
- **THEN** the writer is not called in the first case and called once with the JSON path `test/eval/baseline.json` in the second
