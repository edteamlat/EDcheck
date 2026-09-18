## Why

EDcheck has a locked product contract (constitution v1.1) and zero runtime code. Every later
change (`context-inheritance`, `cross-field-rules`, `score-rules`, `gateway-provider`,
`observability-hooks`, `node-validation`, `evaluation-harness`) depends on a walking skeleton that
fixes the public API, the `SemanticProvider` contract and the test harnesses. This change builds
that skeleton end to end: a plain Zod object, Noul rules on its primitive fields, one provider
request per validated object, and a unified `SemanticResult`.

It also closes the four §13 questions that block everything else: how rules attach to a Zod schema
(§13.1), which provider dependency is used (§13.2), the public API names (§13.3) and how arrays are
handled in v1 (§13.6).

## What Changes

- `createEDcheck({ provider, timeoutMs?, policy?, thresholds? })` returns a configured instance.
  It throws an explicit error when executed in a browser environment.
- `instance.define(zodObject, { rules, thresholds?, policy? })` binds `semantic(...)` rules to
  leaf paths of a `z.object` (dotted paths into nested objects). The Zod schema is not mutated and
  stays importable on the client without `edcheck`.
- `semantic(statement | options)` builds an immutable Noul rule: `intent`, `valid`, `invalid`,
  `thresholds`, `severity`, `message`, `id`. `kind: "score"` and cross-field `paths` are **not**
  part of this change.
- `bound.safeParse(data, { signal?, timeoutMs? })` runs Zod first, excludes rules whose node failed
  shape, compiles the surviving rules into **one** provider request, maps every answer to
  `pass | warning | fail` and assembles `SemanticResult<z.output<S>>` with Zod issues passed through.
- `SemanticProvider` contract (`evaluate(request, { signal })`) plus two adapters: `mockProvider`
  (deterministic, records calls, mandatory for the unit suite) and `typesafeProvider` (TypeSafe HTTP
  API via native `fetch`, bounded retries on `429`/`529`).
- Provisional default thresholds `{ pass: 0.8, fail: 0.5 }`, exported as `DEFAULT_THRESHOLDS`.
  Precedence rule > schema > instance > defaults.
- Failure policy `open` (default) and `closed`: provider failure or timeout yields one
  `semantic_unavailable` issue per affected rule.
- Typed errors: `EDcheckError`, `EDcheckConfigError`, `EDcheckEnvironmentError`,
  `EDcheckProviderError`, `EDcheckAbortError`.
- Arrays: attaching a rule to or through a `z.array` is a configuration error in v1. Zod issues on
  array items still pass through with their numeric indices.
- Test harnesses born here: public-surface symbol list, compiled-payload snapshots taken from the
  mock provider's recorded requests, `test/types/*.test-d.ts` for `z.infer` preservation, a first
  `full-name` fixture set (`es`/`en`) and a smoke eval against real Jev, skipped without a key.

## Capabilities

### New Capabilities

- `semantic-rules`: the `semantic()` builder, its basic and advanced forms, validation of options
  and immutability of the resulting rule.
- `schema-binding`: `createEDcheck`, `define`, path resolution against the Zod schema, the
  server-only guard, shape-first execution with per-node exclusion, and cancellation/timeout
  semantics of `safeParse`.
- `compilation`: how surviving rules become one provider request: state minimization, question
  template, rule ids, ordering, and the guarantee that user values never enter
  `instructions`/`criteria`.
- `provider`: the `SemanticProvider` contract, the `mock` adapter, the `typesafe` adapter (HTTP
  mapping, retries, error taxonomy) and timeout enforcement.
- `outcome-policy`: default thresholds, probability → outcome mapping, threshold precedence,
  severity resolution and the `open`/`closed` failure policy.
- `result`: `Issue` and `SemanticResult` shapes, Zod passthrough, `success` semantics, issue
  ordering and type preservation of `data`.

### Modified Capabilities

None. `openspec/specs/` is empty; this change creates the first six specs.

## Impact

- **Public API (new exported runtime symbols):** `createEDcheck`, `semantic`, `typesafeProvider`,
  `mockProvider`, `DEFAULT_THRESHOLDS`, `EDcheckError`, `EDcheckConfigError`,
  `EDcheckEnvironmentError`, `EDcheckProviderError`, `EDcheckAbortError`.
  **Exported types:** `EDcheck`, `EDcheckOptions`, `SemanticSchema`, `SemanticSchemaOptions`,
  `SemanticRule`, `SemanticRuleOptions`, `ParseOptions`, `SemanticProvider`, `SemanticRequest`,
  `SemanticResponse`, `SemanticQuestion`, `SemanticAnswer`, `SemanticUsage`, `MockProvider`,
  `MockProviderOptions`, `TypesafeProviderOptions`, `Issue`, `SemanticResult`, `Thresholds`,
  `Severity`, `Outcome`, `FailurePolicy`, `FieldPath`.
- **Modules created (constitution §11):** `schema/`, `rules/`, `compiler/`, `providers/`,
  `policy/`, `result/`, `errors/`, `shared/`, plus a new `api/` module that hosts `createEDcheck`,
  `define` and the parse orchestrator. `index.ts` re-exports and is the only file that imports
  concrete adapters. `design.md` records the `api/` addition; the constitution §11 table is updated
  in the last task.
- **Dependencies:** no new runtime dependency. `zod` stays a `peerDependency`. `typesafeProvider`
  uses native `fetch` (Node ≥ 20). `ai` is not installed; a TypeSafe-direct user never pulls it in.
  No new devDependency.
- **Tooling:** a Vitest alias `edcheck → src/index.ts` so behavior tests import the package name.
- **Docs:** README gains the client (Zod) / server (EDcheck) example. `openspec/roadmap.md` marks
  change 1 in progress and records the §13.6 decision (arrays out of v1; change 9 stays deferred).
- **Deferred to later changes (unchanged by this proposal):** context inheritance (2), cross-field
  rules and object-node rules (3), node-level validation (4), `kind: "score"` (5), Gateway adapter
  and key detection (6), observability hooks (7), threshold calibration (8).
