## Context

`src/index.ts` exports nothing. The constitution locks the product contract (§4), the execution
model (§6), the Jev facts (§7), the module map (§11) and TDD (§12.1), and leaves six questions open
(§13). This change closes §13.1 (rule attachment), §13.2 (provider dependency), §13.3 (public API
names) and §13.6 (arrays). §13.4 (calibrated thresholds) is closed by `evaluation-harness`; §13.5
(node validation) by `node-validation`.

Verified against TypeSafe docs on 2026-09-17: `POST https://api.typesafe.ai/v1/systemone`,
`Authorization: Bearer <key>`, body `{ state, model, questions }` → `{ model, answers, usage }`
with `usage: { input_tokens, output_tokens }`. Noul answers are `{ type: "noul", noul }`. Errors:
`401`, `422`, `429`, `529`; the docs ask for exponential backoff on `429`/`529`. The official
`@typesafe-ai/sdk@0.6.0` has no runtime dependencies but does not document `AbortSignal` support
or a configurable retry policy.

## Goals / Non-Goals

**Goals:**

- Fix the public API so later changes are additive.
- One provider request per `safeParse` of a whole object; zero requests when nothing survives shape.
- `SemanticProvider` contract that the `mock`, `typesafe` and (later) `gateway` adapters implement
  without knowing `rules/`, `schema/` or `result/`.
- Cancellation and timeout that never emit a stale or cancelled result and never leak an unhandled
  rejection.
- Harnesses: public-surface list, compiled-payload snapshots, type tests, first fixture set,
  skippable smoke eval.

**Non-Goals:**

- Context (string/object, `notes[]`, inheritance). State in this change is the minimized object
  only; `context-inheritance` adds the `context` key.
- Cross-field rules, rules on object nodes, `paths`, backtick references to sibling fields.
- `kind: "score"`, `levels`, confidence.
- Node-level validation, Gateway adapter, key detection from `process.env`, observability hooks.
- Rules on arrays, per-item fan-out, rules on `pipe`/`transform` outputs.
- Calibrated thresholds. The defaults here are provisional and labelled as such.
- Localization of default messages beyond the per-rule `message` override.

## Decisions

Every decision lists the rejected alternative and the rationale. §4 is not reopened.

### D1. Rule attachment (§13.1): bound semantic schema via `instance.define(zodObject, options)`

```ts
const edcheck = createEDcheck({ provider: typesafeProvider({ apiKey }) });
const UserSemantic = edcheck.define(User, {
  rules: { fullName: semantic("A plausible full name for a real person") },
});
const result = await UserSemantic.safeParse(input, { signal });
```

- The Zod schema is a plain `z.object`; `define` reads it and never mutates it. The client imports
  `User` from a shared module without `edcheck` (principle 1).
- Paths are validated once, at `define` time, and produce typed configuration errors. This is the
  natural home for `node-validation` (change 4) and for schema-level context/thresholds/policy.
- Rejected: **(a) rules map at parse time** `parseSemantic(User, data, { rules })`. Re-validates
  paths per call and has no object on which node-level validation can live.
- Rejected: **(c) Zod metadata** `.meta({ edcheck: … })`. Untyped magic keys, depends on Zod's
  global registry, and a client-safe entry would either import `edcheck` or duplicate the rule
  vocabulary on the client.

### D2. Public API names (§13.3)

| Symbol                                                      | Kind     | Notes                                                       |
| ----------------------------------------------------------- | -------- | ----------------------------------------------------------- |
| `createEDcheck(options): EDcheck`                           | function | Factory. No exported class.                                 |
| `EDcheck.define(schema, options): SemanticSchema<S>`        | method   | Binds rules to a `z.object`.                                |
| `SemanticSchema.safeParse(data, options?): Promise<Result>` | method   | The only parse entry. Never throws for validation outcomes. |
| `SemanticSchema.schema`                                     | property | The bound Zod schema, unchanged.                            |
| `semantic(statement \| options): SemanticRule`              | function | Noul rule builder.                                          |
| `typesafeProvider(options): SemanticProvider`               | function | TypeSafe HTTP adapter.                                      |
| `mockProvider(options?): MockProvider`                      | function | Deterministic adapter that records calls.                   |
| `DEFAULT_THRESHOLDS`                                        | const    | `{ pass: 0.8, fail: 0.5 }`, provisional.                    |
| `EDcheckError` and subclasses                               | classes  | See D9.                                                     |

- Rejected: a throwing `parse`. A result with warning-only issues is `success: true`; throwing on
  `success: false` conflates transport with policy. It can be added later without breaking.
- Rejected: `parseSemantic` / `safeParseSemantic` free functions. They need the provider on every
  call or a second object; the bound schema already carries the instance.
- `mockProvider` is public because consuming apps must test their own routes offline and the
  single-entry rule (§3.2, package-contract test) forbids an `edcheck/testing` subpath.

### D3. Provider dependency (§13.2): native `fetch`, no runtime dependency

- `typesafeProvider` performs the HTTP call with `globalThis.fetch` (Node ≥ 20). Option
  `fetch?: typeof fetch` allows injection; the default is `globalThis.fetch`.
- Rejected: `@typesafe-ai/sdk`. Zero-dependency and typed, but abort propagation and retry policy
  are not documented; the constitution needs exact `AbortSignal` semantics (race tests) and
  "bounded retries that never silently duplicate cost". Owning the single endpoint is ~100 lines.
  Revisit in a later change if the SDK documents `signal` and retry configuration.
- Rejected: `ai` for the direct route. A TypeSafe-direct user MUST NOT pull in `ai` (§7). `ai`
  arrives in `gateway-provider` as an optional peer, guarded by the package-contract test.
- Retry policy: retry only `429` and `529` (the server states it did not process the request),
  `retries` attempts (default `2`), delay `retryDelayMs * 2^attempt` (default base `250`). Network
  errors, `4xx`/`5xx` other than `429`/`529`, timeouts and aborts are never retried.
- Response validation uses a small Zod schema inside `providers/typesafe/`. `zod` is a peer and
  `providers/` may import it; it may not import `schema/`, `rules/` or `result/`.

### D4. Arrays (§13.6): out of v1

- At `define` time a rule path that targets a `z.array` or traverses one throws
  `EDcheckConfigError` with code `unsupported_node` and a message naming the path and stating
  that array rules are not supported in v1.
- Zod issues on array items (`["tags", 0]`) pass through unchanged; a Zod schema may contain arrays
  as long as no semantic rule points into them.
- Rationale: fan-out cost is unbounded without an item cap, and a cap needs eval data that does
  not exist yet. Change 9 `array-rules` stays optional; the roadmap is updated accordingly.
- Rejected: silently evaluating the first N items. Hidden cost and hidden semantics.

### D5. Supported rule targets

`define` resolves each dotted path through `z.object` shapes, unwrapping `optional`, `nullable`,
`default`, `prefault`, `readonly`, `catch` and `nonoptional`. The resolved node MUST be a
primitive: `string`, `number`, `boolean`, `enum`, `literal`. Everything else is
`EDcheckConfigError`:

| Situation                                        | code                       |
| ------------------------------------------------ | -------------------------- |
| Path segment not in shape                        | `unknown_path`             |
| Node is `array` or path traverses one            | `unsupported_node`         |
| Node is `object`, `union`, `pipe`, `date`, other | `unsupported_node`         |
| Root schema is not a `z.object`                  | `unsupported_schema`       |
| Two rules resolve to the same rule id            | `duplicate_rule_id`        |
| `fail > pass` or values outside `[0, 1]`         | `invalid_thresholds`       |
| Empty / whitespace statement or intent           | `invalid_rule`             |
| Unknown `severity` or `policy` (JS callers)      | `invalid_option`           |
| `typesafeProvider` without `apiKey`              | `invalid_provider_options` |

Rejected: accepting `pipe`/`transform` by classifying the input side. The evaluated value is the
output; its shape is unknowable statically.

### D6. Execution pipeline (§6) inside `api/`

1. `schema.safeParse(data)`.
2. Build the invalid-prefix set from Zod issue paths. A rule is excluded when any issue path is a
   prefix of the rule path. The root path `[]` excludes every rule.
3. For each surviving rule, obtain its value:
   - shape passed → read from `parsed.data` at the rule path;
   - shape failed elsewhere → re-parse the rule's resolved node with the raw value at the path
     (`node.safeParse(getAtPath(input, path))`). Failure excludes the rule. This keeps "the value
     Jev sees is the node's Zod output" true in both branches (`.trim()`, `.default()`).
   - `undefined` or `null` → rule skipped, no issue.
4. Zero surviving rules → assemble the result without touching the provider.
5. `compiler` builds one `SemanticRequest`: `state` is an object mirroring the schema structure
   restricted to surviving rule paths; `questions` keyed by rule id, in rule declaration order.
6. Combine the caller `signal` with `AbortSignal.timeout(timeoutMs)` through `shared/` (manual
   listeners; `AbortSignal.any` is not assumed). Call `provider.evaluate(request, { signal })`.
7. Outcome per rule via `policy/`; failure of the whole request via the failure policy.
8. `result/` assembles: Zod issues first, then semantic issues in rule order.

Cancellation contract: if the caller signal is aborted before or during the call, `safeParse`
rejects with `EDcheckAbortError` and nothing else is emitted. Timeout is not cancellation: it is a
provider failure (`EDcheckProviderError`, code `timeout`) and goes through the failure policy. The
orchestrator distinguishes the two by checking `callerSignal.aborted` when the provider rejects.

### D7. Compilation template

For rule `r` at dotted path `p` with `intent` (the statement in the basic form):

```json
{
  "state": { "<p>": "<Zod output value>" },
  "questions": {
    "<ruleId>": {
      "type": "noul",
      "instructions": "Does `<p>` fit the following description? <intent>",
      "criteria": { "true": "<valid>", "false": "<invalid>" }
    }
  }
}
```

- `criteria` is omitted when neither `valid` nor `invalid` is set; a key is omitted when its value
  is not set.
- Nested paths mirror structure in `state` (`{ address: { street: "…" } }`) and are written
  dotted with backticks in `instructions` (`` `address.street` ``).
- `ruleId` = explicit `id`, else the dotted path.
- The user value appears only in `state`. The template is a constant; wording changes surface in
  the payload snapshots and are reviewed.
- Rejected: including the schema field description or the Zod `description` metadata. Not part of
  this change; `context-inheritance` decides what else enters the state.

### D8. Outcome, thresholds, severity, failure policy

- Noul: `p ≥ pass → pass` (no issue) · `fail ≤ p < pass → warning` · `p < fail → fail`.
- `DEFAULT_THRESHOLDS = { pass: 0.8, fail: 0.5 }`. Rationale, provisional: below even odds the
  statement is more likely false than true; above 0.8 is a confident yes; in between is uncertain.
  `evaluation-harness` replaces these with fixture-backed values.
- Thresholds are `Partial<Thresholds>` at rule, schema and instance level; effective =
  `{ ...DEFAULT, ...instance, ...schema, ...rule }`, validated at `define` time.
- Issue severity: outcome `fail` → the rule's `severity` (default `error`); outcome `warning` →
  the less severe of the rule's `severity` and `warning` (`error > warning > info`).
- Failure policy `open | closed`, precedence schema > instance > default `open`. A provider
  failure produces one issue per surviving rule: `code: "semantic_unavailable"`, `path` = rule
  path, `ruleId`, no `probability`, severity `warning` (`open`) or `error` (`closed`).
- A response missing an answer for any question id, or with `noul` outside `[0, 1]`, is a
  `malformed_response` provider failure for the whole request.

### D9. Errors (`errors/`, one class per file)

| Class                     | When                                                 | Fields                                                                           |
| ------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `EDcheckError`            | Base. Never thrown directly.                         | `code: string`                                                                   |
| `EDcheckConfigError`      | Invalid options at `createEDcheck`/`define`/builders | `code` from D5, `path?: string`                                                  |
| `EDcheckEnvironmentError` | Browser detected                                     | message points to "use your API route"                                           |
| `EDcheckProviderError`    | Adapter failure                                      | `code: http \| network \| timeout \| malformed_response`, `status?`, `retryable` |
| `EDcheckAbortError`       | Caller signal aborted                                | `cause` = signal reason                                                          |

Browser detection: `globalThis.window !== undefined && globalThis.document !== undefined`.
Checked in `createEDcheck` and again in `safeParse`.

### D10. `SemanticProvider` contract (`providers/types/`)

```ts
interface SemanticProvider {
  readonly name: string;
  evaluate(request: SemanticRequest, options: { signal: AbortSignal }): Promise<SemanticResponse>;
}
type SemanticRequest = {
  state: Record<string, unknown>;
  questions: Record<string, SemanticQuestion>;
};
type SemanticQuestion = {
  type: "noul";
  instructions: string;
  criteria?: { true?: string; false?: string };
};
type SemanticResponse = {
  model: string;
  answers: Record<string, SemanticAnswer>;
  usage?: SemanticUsage;
};
type SemanticAnswer = { type: "noul"; noul: number };
type SemanticUsage = { inputTokens: number; outputTokens: number };
```

The request carries no model; the adapter chooses it (`typesafeProvider` option `model`, default
`"jev-latest"`). Adapters throw `EDcheckProviderError` for every failure except abort, where they
rethrow the signal's reason. `MockProvider extends SemanticProvider` with
`readonly calls: readonly SemanticRequest[]`; options `answers` (map by id or function),
`defaultAnswer` (`0.9`), `delayMs`, `error`, `model` (`"mock"`). While delaying, the mock
rejects with the signal's reason when aborted.

### D11. Module map and boundaries

New module `api/` (not in the §11 table; added to the constitution in the last task):
`create-edcheck.ts`, `define-semantic-schema.ts`, `run-safe-parse.ts`, `types/`. It imports
`schema`, `rules`, `compiler`, `policy`, `result`, `errors`, `shared` and the provider **contract**
only. `index.ts` re-exports `api/`, `rules/`, `errors/`, `policy/default-thresholds` and the two
concrete adapters; it is the only file that imports `providers/typesafe` and `providers/mock`.

| Module       | Files (one exported symbol each)                                                                                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/`    | `parse-path`, `format-path`, `is-path-prefix`, `get-at-path`, `set-at-path`, `combine-signals`, `is-browser-environment`, `assert-server-environment`                                                                             |
| `errors/`    | one file per class in D9                                                                                                                                                                                                          |
| `rules/`     | `semantic`, `normalize-rule`, `types/semantic-rule`, `types/semantic-rule-options`, `types/severity`                                                                                                                              |
| `schema/`    | `resolve-node`, `classify-node`, `unwrap-node`, `collect-invalid-prefixes`, `types/resolved-node`, `types/node-kind`                                                                                                              |
| `compiler/`  | `compile-request`, `build-state`, `build-question`, `question-template` (constant)                                                                                                                                                |
| `providers/` | `types/*` (D10), `mock/mock-provider`, `mock/types/mock-provider-options`, `typesafe/typesafe-provider`, `typesafe/types/typesafe-provider-options`, `typesafe/response-schema`, `typesafe/map-response`, `typesafe/should-retry` |
| `policy/`    | `default-thresholds`, `validate-thresholds`, `resolve-thresholds`, `map-probability-to-outcome`, `resolve-severity`, `types/thresholds`, `types/outcome`, `types/failure-policy`                                                  |
| `result/`    | `assemble-result`, `from-zod-issue`, `semantic-issue`, `unavailable-issue`, `default-messages`, `types/issue`, `types/semantic-result`                                                                                            |
| `api/`       | `create-edcheck`, `define-semantic-schema`, `run-safe-parse`, `types/edcheck`, `types/edcheck-options`, `types/semantic-schema`, `types/semantic-schema-options`, `types/parse-options`, `types/field-path`                       |

`FieldPath<T>` is derived from `z.output<S>`: dotted leaf paths, never through arrays. `rules` is
`Partial<Record<FieldPath<z.output<S>>, SemanticRule>>`.

### D12. Test strategy

- **Through the public entry (`test/api/`)**, importing `edcheck` via a Vitest alias to
  `src/index.ts`: every `schema-binding`, `compilation`, `result` and `outcome-policy` behavior
  scenario; provider failure under both policies; abort and timeout; adversarial and edge strings.
  The mock provider is the only mock. Compiled payloads are snapshotted from `mock.calls[0]`.
- **Direct unit tests**: `test/policy/` (probability → outcome, threshold merge, severity),
  `test/shared/` (path utilities, signal combination, environment detection), `test/rules/`
  (`semantic()` normalization and validation). These are pure, stable and have many boundary
  values; testing them through `safeParse` would multiply provider setups without adding coverage.
- **Provider adapter tests** (`test/providers/`): `mockProvider` against the contract;
  `typesafeProvider` with an injected `fetch` function. Injecting `fetch` is the provider
  boundary itself, not a second mock: it stands in for the network, which is what the adapter
  wraps. `retryDelayMs: 0` keeps retry tests fast; no fake timers.
- **Environment guard**: `vi.stubGlobal("window", {})` and `document`. This stubs the runtime,
  not a module.
- **Unhandled rejection guard**: abort tests register `process.once("unhandledRejection")` and
  assert it never fires after `await` settles.
- **Type tests** (`test/types/*.test-d.ts`): `result.data` is `z.output<S> | undefined`; unknown
  rule key and array path are type errors; `SemanticProvider` is implementable by an object
  literal; `semantic()` return type is `SemanticRule`.
- **Public surface** (`test/api/public-surface.test.ts`): sorted `Object.keys(await import("edcheck"))`
  equals the runtime list in the proposal.
- **Package contract**: existing test extended to assert `ai` and `@typesafe-ai/sdk` are absent
  from `dependencies`.
- **Fixtures** `test/fixtures/full-name/{es,en}.json`: `{ positive: [], negative: [], ambiguous: [] }`
  including an adversarial string and an RTL name. Used by the unit suite (payload snapshots) and
  by the eval.
- **Eval** `test/eval/full-name.eval.test.ts`: `describe.skipIf(!process.env.TYPESAFE_API_KEY)`;
  asserts `p ≥ 0.6` for positives and `p ≤ 0.4` for negatives with the real `typesafeProvider`;
  ambiguous cases are only logged into the assertion message, never asserted. A miss is a
  calibration signal, not a build failure, and it never runs without a key.

## Risks / Trade-offs

- [Question wording drives accuracy; the D7 template is a guess] → snapshot every payload; the
  template is one constant; `evaluation-harness` recalibrates wording with fixtures.
- [Provisional thresholds mislabel real data] → exported as `DEFAULT_THRESHOLDS`, documented as
  provisional in README, replaced in change 8.
- [Re-parsing a node when a sibling failed doubles Zod work] → only in the failure branch, only for
  rule nodes; cost is negligible next to a network call.
- [Own `fetch` drifts from the TypeSafe API] → the adapter is a single endpoint with a Zod-validated
  response; the smoke eval hits the real API when a key is present.
- [Root-level Zod issue excludes everything] → deliberate (principle 3); documented in the spec;
  a future change may narrow it for `unrecognized_keys`.
- [`FieldPath<T>` recursion on large schemas slows typecheck] → depth is bounded by the schema;
  arrays terminate the recursion; type tests cover a three-level schema.
- [`mockProvider` becomes public API surface] → tiny, dependency-free, and consumers need it;
  documented as a testing utility.

## Migration Plan

No consumers yet. Nothing to migrate. The change is additive from an empty surface.

## Open Questions

None for this change. §13.4 (calibrated thresholds) and §13.5 (node-level validation) remain open
for `evaluation-harness` and `node-validation`.
