Every task ends with `yarn verify` green. Red tasks write failing tests for the listed spec
scenarios and stop; green tasks make them pass with the minimum code that respects `design.md`.
Tests import the package as `edcheck` (alias) unless the task says "direct unit test". Scenario
names refer to `specs/<capability>/spec.md`.

## 1. Tooling scaffold (no features)

- [x] 1.1 Add Vitest alias `edcheck → ./src/index.ts` in `vitest.config.ts` and the matching
      `paths` entry in `tsconfig.json`. Create empty `test/api/`, `test/types/`, `test/eval/`,
      `test/fixtures/` with `.gitkeep`. Add `test/types/**/*.test-d.ts` to `tsconfig` include if
      not covered. `yarn verify` green.
- [x] 1.2 Extend `test/package-contract.test.ts` with the `provider` scenario "Package pulls in
      neither ai nor the SDK". Passes immediately; it guards D3 from now on.

## 2. Errors and shared utilities

- [x] 2.1 Red — direct unit tests `test/shared/paths.test.ts`: `parsePath("a.b.c")` →
      `["a","b","c"]`; `formatPath(["a","b"])` → `"a.b"`; `isPathPrefix([], x)` is `true` for any
      `x`; `isPathPrefix(["a"], ["a","b"])` true, `(["a","b"], ["a"])` false, `(["a"], ["ab"])`
      false; `getAtPath` on missing segments → `undefined`; `setAtPath` creates nested objects
      and does not touch sibling keys.
- [x] 2.2 Green — `src/shared/{parse-path,format-path,is-path-prefix,get-at-path,set-at-path}.ts` + `src/shared/index.ts`.
- [x] 2.3 Red — direct unit tests `test/shared/combine-signals.test.ts`: aborting either input
      aborts the combined signal with the same reason; already-aborted input yields an aborted
      combined signal synchronously; `timeoutMs` aborts with a reason distinguishable from a
      caller abort (`TimeoutError`-named reason); listeners are removed after settle (no growth
      on repeated calls, checked via `getEventListeners` from `node:events`).
      `test/shared/environment.test.ts`: `isBrowserEnvironment()` is `false` in Node, `true` with
      `vi.stubGlobal("window", {})` and `document`; `assertServerEnvironment()` throws
      `EDcheckEnvironmentError` with "API route" in the message.
- [x] 2.4 Green — `src/shared/{combine-signals,is-browser-environment,assert-server-environment}.ts`,
      `src/errors/{edcheck-error,edcheck-config-error,edcheck-environment-error,edcheck-provider-error,edcheck-abort-error}.ts` + barrels. Export the five error classes from `src/index.ts`.

## 3. Semantic rules

- [x] 3.1 Red — `test/api/semantic-rule.test.ts` covering all `semantic-rules` scenarios except
      "The same rule can be bound twice": statement defaults, empty statement, all options
      preserved, partial criteria, empty intent, invalid thresholds (`fail > pass`, `pass: 1.2`,
      `fail: -0.1`), partial thresholds accepted, unknown severity, empty id, frozen rule.
- [x] 3.2 Green — `src/rules/{semantic,normalize-rule}.ts`, `src/rules/types/{semantic-rule,semantic-rule-options,severity}.ts`,
      `src/policy/types/thresholds.ts`, `src/policy/validate-thresholds.ts`. Export `semantic`
      and the types.

## 4. Outcome policy (pure logic)

- [x] 4.1 Red — direct unit tests `test/policy/map-probability-to-outcome.test.ts`: `0.95`,
      `0.8` (pass), `0.79`, `0.5` (warning), `0.49`, `0` (fail), `1` (pass), collapsed band
      `{0.7,0.7}` with `0.7` and `0.69`. `test/policy/resolve-thresholds.test.ts`: four-level
      merge with partials; `DEFAULT_THRESHOLDS` frozen and equal to `{ pass: 0.8, fail: 0.5 }`;
      invalid effective merge throws `invalid_thresholds`. `test/policy/resolve-severity.test.ts`:
      the five `Severity resolution` scenarios as a table.
- [x] 4.2 Green — `src/policy/{default-thresholds,resolve-thresholds,map-probability-to-outcome,resolve-severity}.ts`,
      `src/policy/types/{outcome,failure-policy}.ts`. Export `DEFAULT_THRESHOLDS`.

## 5. Provider contract and mock adapter

- [x] 5.1 Red — `test/providers/mock-provider.test.ts`: default answer, answers by id, answers by
      function, calls recorded, injected error, abort while delaying (assert elapsed < 100 ms),
      custom model. `test/types/semantic-provider.test-d.ts`: object literal satisfies
      `SemanticProvider`; `MockProvider` is assignable to `SemanticProvider`.
- [x] 5.2 Green — `src/providers/types/{semantic-provider,semantic-request,semantic-response,semantic-question,semantic-answer,semantic-usage}.ts`,
      `src/providers/mock/mock-provider.ts`, `src/providers/mock/types/{mock-provider,mock-provider-options}.ts`.
      Export `mockProvider` and the types from `src/index.ts`.
- [x] 5.3 Red — `test/providers/import-boundaries.test.ts`: read every file under
      `src/providers/**` and assert no import specifier resolves into `src/rules`, `src/schema`,
      `src/result`, `src/compiler` or `src/api` (scenario "Provider module has no forbidden
      imports"). Passes immediately; guards §11 from now on.

## 6. Schema introspection and binding

- [x] 6.1 Red — `test/api/create-edcheck.test.ts`: `Instance creation` scenarios (defaults,
      missing provider, invalid thresholds, invalid policy, non-positive timeout) and
      `Server-only guard` scenarios (createEDcheck in a browser, safeParse in a browser after
      creation elsewhere, Node allowed) using `vi.stubGlobal`.
- [x] 6.2 Red — `test/api/define.test.ts`: `Binding rules to leaf paths` scenarios: top-level,
      nested dotted path (assert only that `define` succeeds here; state shape is asserted in
      task 7), wrapped leaves, unknown path, unknown nested segment, array node, through array
      (`items.0.name` and `items.name`), object node, transformed node, root not object,
      duplicate ids, empty rules map, schema-level thresholds validated against effective merge,
      Zod schema not mutated, and `semantic-rules` "The same rule can be bound twice" (define
      only).
- [x] 6.3 Green — `src/schema/{unwrap-node,classify-node,resolve-node,collect-invalid-prefixes}.ts`,
      `src/schema/types/{node-kind,resolved-node}.ts`, `src/api/{create-edcheck,define-semantic-schema}.ts`,
      `src/api/types/{edcheck,edcheck-options,semantic-schema,semantic-schema-options,parse-options,field-path}.ts`.
      `safeParse` may throw "not implemented" at this point. Export `createEDcheck` and types.

## 7. Compilation, result assembly and the happy path

- [x] 7.1 Red — `test/fixtures/full-name/{es,en}.json` with `positive`, `negative`, `ambiguous`
      arrays (≥ 4 each; negatives include `"asdfasdf"` and the adversarial string; positives
      include an RTL name in `es` and a hyphenated name in `en`). `test/api/safe-parse.test.ts`
      happy path: `compilation` "Six rules, one request, six questions", "State is restricted to
      rule fields", "Nested state mirrors structure", "Non-string primitives are sent as-is";
      `Question template` scenarios including the payload snapshot for the fixture `full-name`
      rule and the PDR `bio` rule; `Rule ids and ordering` scenarios; `result` "Fail issue is
      fully populated", "Nested path is an array", "Default warning message", "Custom message
      replaces both templates", "Pass emits nothing"; `outcome-policy` "Defaults apply when
      nothing overrides", "Exported constant".
- [x] 7.2 Green — `src/compiler/{question-template,build-question,build-state,compile-request}.ts`,
      `src/result/{default-messages,from-zod-issue,semantic-issue,unavailable-issue,assemble-result}.ts`,
      `src/result/types/{issue,semantic-result}.ts`, `src/api/run-safe-parse.ts` (shape pass
      branch, no failure handling yet). Commit the snapshot file after reviewing the wording.

## 8. Shape-first exclusion and Zod passthrough

- [x] 8.1 Red — extend `test/api/safe-parse.test.ts` with `schema-binding` `Shape-first
execution` scenarios: shape failure on one node excludes only that node (exactly one call,
      no `bio` in `state` or `questions`), shape failure on every rule node → zero calls, root
      issue on `strictObject` → zero calls, surviving `.trim()` node receives trimmed value,
      `.default()` value, optional absent skips rule, only rule absent → zero calls and
      `issues: []`, Zod issue inside an array passes through with numeric index. `result` `Zod
issues pass through unchanged` scenarios, `Success semantics` scenarios ("Mixed Zod and
      semantic issues share one array", "Semantic issues follow declaration order", "Only
      warnings and infos", "Semantic error with shape pass keeps data"), "Zod-only schema without
      rules".
- [x] 8.2 Green — invalid-prefix collection, node re-parse in the failure branch, `undefined`/
      `null` skip, result ordering in `run-safe-parse.ts` / `assemble-result.ts`.

## 9. Thresholds, severity and adverse strings through the public entry

- [x] 9.1 Red — `test/api/outcome-policy.test.ts`: `Probability to outcome mapping` scenarios
      through `safeParse` with `mockProvider({ answers })` (clear pass, at pass, below pass, at
      fail, below fail, extremes, collapsed band); `Threshold precedence` scenarios (rule >
      schema > instance, sibling independence, instance-only); `Severity resolution` scenarios
      asserting `severity`, `outcome` and `success`.
- [x] 9.2 Red — `test/api/values.test.ts`: `compilation` `User values never enter the question`
      scenarios: adversarial value, template-like characters, empty and whitespace-only, 50 000
      characters, emoji and RTL.
- [x] 9.3 Green — wire thresholds/severity precedence into `run-safe-parse.ts`; fix anything the
      value tests expose. If 9.2 is already green, record it in the task note and move on.

## 10. Failure policy, cancellation and timeout

- [x] 10.1 Red — `test/api/failure-policy.test.ts`: `outcome-policy` `Failure policy` scenarios:
      open keeps success, closed fails, schema-level overrides instance, Zod issues coexist with
      unavailable issues, missing answer marks whole request unavailable, unavailable issue does
      not leak the key, non-provider errors are not swallowed. Include a custom provider that
      returns `noul: 1.5` → whole request unavailable.
- [x] 10.2 Red — `test/api/cancellation.test.ts`: `schema-binding` `Cancellation and timeout`
      scenarios (pre-aborted, abort in flight with `unhandledRejection` guard, reason preserved,
      timeout under open, per-call timeout override, fast provider leaves caller signal
      untouched) and `provider` `Timeout enforcement` scenarios (provider signal aborted at
      timeout, timeout under closed, caller abort during timeout window is still an abort).
- [x] 10.3 Green — failure policy branch, response validation (every id present, `noul ∈ [0,1]`),
      `combineSignals` usage, abort vs timeout discrimination in `run-safe-parse.ts`.

## 11. TypeSafe adapter

- [x] 11.1 Red — `test/providers/typesafe-provider.test.ts` with an injected `fetch` recording
      calls: request shape, custom model and baseUrl, response mapping, missing apiKey,
      non-retryable `401`/`422`/`500`, `429` retried three times with `retryDelayMs: 0`, `529`
      then `200`, `retries: 0`, network `TypeError`, malformed responses (non-JSON, no `answers`,
      missing id, `noul: 1.5`), abort propagated and not retried.
- [x] 11.2 Green — `src/providers/typesafe/{typesafe-provider,response-schema,map-response,should-retry}.ts`,
      `src/providers/typesafe/types/typesafe-provider-options.ts`. Export `typesafeProvider` and
      `TypesafeProviderOptions` from `src/index.ts`.
- [x] 11.3 Red then green — `test/api/custom-provider.test.ts`: `provider` "Custom provider is
      accepted by createEDcheck".

## 12. Type tests

- [x] 12.1 Red — `test/types/semantic-result.test-d.ts`: `result` `Type preservation` scenarios
      (data is `z.output`, unknown key `@ts-expect-error`, nested and optional keys accepted,
      array paths rejected, `Issue`/`SemanticResult` exported). `test/types/semantic-rule.test-d.ts`:
      `semantic()` returns `SemanticRule`; `severity` literal union. Use a three-level schema for
      `FieldPath` depth.
- [x] 12.2 Green — adjust `FieldPath<T>` and public type exports until `yarn typecheck` and
      `vitest --typecheck` pass.

## 13. Smoke eval against real Jev

- [x] 13.1 `test/eval/full-name.eval.test.ts`: `describe.skipIf(!process.env.TYPESAFE_API_KEY)`;
      for each fixture language, positives yield `probability ≥ 0.6` (or no issue) and negatives
      yield `probability ≤ 0.4`; ambiguous cases are listed in the assertion message only.
      Verify locally with a key once; the suite is skipped in `yarn verify` without one.

## 14. Public surface, docs and roadmap

- [x] 14.1 Red — `test/api/public-surface.test.ts`: sorted `Object.keys(await import("edcheck"))`
      equals `["DEFAULT_THRESHOLDS","EDcheckAbortError","EDcheckConfigError","EDcheckEnvironmentError","EDcheckError","EDcheckProviderError","createEDcheck","mockProvider","semantic","typesafeProvider"]`.
- [x] 14.2 Green — prune or add exports in `src/index.ts` until the list matches exactly.
- [x] 14.3 README: install (`yarn add edcheck zod`), shared Zod schema on the client, server route
      with `createEDcheck` + `typesafeProvider`, `semantic` basic and advanced forms, result
      shape, `DEFAULT_THRESHOLDS` marked provisional, failure policy, cancellation, "server only"
      note, `mockProvider` for app tests.
- [x] 14.4 Docs: add the `api/` row to constitution §11 and the `api → …` step to the flow line;
      update `openspec/roadmap.md` (change 1 `[~]` → status per progress; change 9 note: arrays
      decided out of v1). Run `openspec validate --all` and `yarn verify`.
