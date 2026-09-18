Every task ends with `yarn verify` green. Red tasks write failing tests for the listed spec
scenarios and stop; green tasks make them pass with the minimum code that respects `design.md`.
Requires `bootstrap-mvp` applied. Scenario names refer to `specs/<capability>/spec.md`.

## 1. Context module (pure logic)

- [ ] 1.1 Red — direct unit tests `test/context/normalize-context.test.ts`: string →
      `{ notes: [s] }`; object shallow-copied and `notes` copied (mutation isolation); empty and
      whitespace string → `invalid_context`; reserved key non-string → `invalid_context`;
      `notes` not an array, containing `""` or a non-string → `invalid_context`; number/null/
      array input → `invalid_context`; `undefined` values dropped; `{}` → `{}`.
- [ ] 1.2 Red — direct unit tests `test/context/merge-contexts.test.ts`: four-level precedence
      table (instance < schema < node < rule) for a reserved key and an open key; missing levels
      skipped; notes concatenated in order across all levels; string level appends a note and
      keeps structured keys; key insertion order is first-introducer order; `notes` emitted last
      and only when non-empty; all-empty input → `{}`; `isEmptyContext` true for `{}` and false
      for `{ notes: ["x"] }`.
- [ ] 1.3 Green — `src/context/{normalize-context,merge-contexts,is-empty-context,reserved-context-keys}.ts`,
      `src/context/types/{context,context-object,effective-context}.ts`, `src/context/index.ts`,
      `src/shared/stable-stringify.ts` (sorted keys, throws on cycles). Add
      `test/shared/stable-stringify.test.ts` first (red): key order independence, nested objects,
      arrays kept in order, cycle → throws.

## 2. Attachment levels through the public entry

- [ ] 2.1 Red — `test/api/context.test.ts` part 1: `context` `Context forms and normalization`
      scenarios via `safeParse` + `mock.calls` (string becomes a note, object carried as-is, notes
      order, empty string rejected at `createEDcheck`, reserved key non-string rejected at
      `define`, invalid notes rejected at `semantic`, non-object rejected, empty object no-op,
      undefined ignored, caller mutation does not leak) and `Attachment levels` scenarios
      (instance, schema, node on object path, node on leaf, rule, basic string rule form, unknown
      node path, node path on array, node context without rule beneath).
- [ ] 2.2 Green — `SemanticRuleOptions.context` + validation/copy in `rules/normalize-rule.ts`;
      `EDcheckOptions.context` validated in `api/create-edcheck.ts`;
      `SemanticSchemaOptions.context` and `nodeContext` validated in
      `api/define-semantic-schema.ts` (reuse `schema/resolve-node`, accept object nodes for
      `nodeContext`); `api/types/node-path.ts`; effective context and `groupKey` resolved per rule
      at `define`; `compiler/build-state.ts` adds `context` when non-empty. Export `Context`,
      `ContextObject`, `NodePath` types from `src/index.ts`.

## 3. Merge semantics and reserved keys through the public entry

- [ ] 3.1 Red — `test/api/context.test.ts` part 2: `Deterministic merge` scenarios (inherits
      everything above, three-level conflict, node beats schema and rule beats node, ancestor
      node order, notes accumulate across levels, string never overrides structured keys, open
      keys precedence, key insertion order, notes always last, resolved at define time);
      `Reserved keys and locale semantics` "Locale only appears in state"; `Context travels only
in state` scenarios (instructions identical with and without context, rule path named
      context, nested rule path under context, node context path named context, field named
      context without rules is fine).
- [ ] 3.2 Green — `schema/is-reserved-path.ts` wired into rule and node path validation
      (`reserved_path`); fix ancestor ordering or key ordering if 3.1 exposed gaps. If part of
      3.1 was already green, note it in the task and continue.

## 4. Grouping, concurrency and isolation

- [ ] 4.1 Red — `test/api/context-groups.test.ts`: `compilation` MODIFIED scenarios "Uniform
      context is still one request", "Distinct rule contexts split into minimal groups", "Group
      order follows first declared rule", "Excluded rules do not create a group", "Groups run
      concurrently" (elapsed < 250 ms with three 100 ms groups), "Failing group is isolated"
      (hand-written provider throwing on `audience === "x"`), "Caller abort rejects the whole
      parse across groups", "Timeout applies to every group". Re-assert the four original
      scenarios still pass (they live in the bootstrap test file; do not duplicate).
- [ ] 4.2 Green — `compiler/plan-groups.ts` (bound rules + surviving set → ordered groups by
      `groupKey`, order by first declaration index); `compiler/compile-request.ts` takes a group;
      `api/run-safe-parse.ts` runs groups with `Promise.all` under the combined signal, maps a
      rejected group to `semantic_unavailable` for its rules only, rethrows `EDcheckAbortError`
      when the caller signal is aborted, and rethrows non-provider errors.

## 5. Snapshots and fixtures

- [ ] 5.1 Red — `test/api/context-snapshot.test.ts`: `Context in state` scenarios: "Context key
      shape"; "Empty effective context leaves the bootstrap payload unchanged" (asserts against
      the existing bootstrap snapshot name, no `-u`); "Snapshot with the PDR project context"
      (new snapshot). Add `context` field to `test/fixtures/full-name/{es,en}.json` with the PDR
      project context so the eval can reuse it later.
- [ ] 5.2 Green — review and commit the new snapshot; confirm `git diff` shows no change to the
      bootstrap snapshot file.

## 6. Type tests

- [ ] 6.1 Red — `test/types/context.test-d.ts`: `Context` accepted at `createEDcheck`, `define`
      (`context` and `nodeContext`), `semantic`; `nodeContext` key for an object path compiles,
      unknown key and array path fail (`@ts-expect-error`); `{ locale: 42 }` fails while
      `{ tenant: 42 }` compiles; `semantic("…")` has no `context` overload (`@ts-expect-error` on
      `semantic("x", { context })`).
- [ ] 6.2 Green — adjust `NodePath<T>`, `ContextObject` index signature and option types until
      `yarn typecheck` and `vitest --typecheck` pass.

## 7. Surface, docs and roadmap

- [ ] 7.1 Assert `test/api/public-surface.test.ts` is unchanged and still green (no runtime
      symbol added). Extend `test/providers/import-boundaries.test.ts` with a `src/context/**`
      check: only `src/shared` imports allowed.
- [ ] 7.2 README: "Context" section — string vs object, reserved keys, the four levels with one
      example, merge rules in four bullets, "identical context = one request; distinct rule
      contexts = one request each", `locale` is not a filter, reserved `context` state key.
- [ ] 7.3 `openspec/roadmap.md`: change 2 status; run `openspec validate --all` and `yarn verify`.
