Every task ends with `yarn verify` green. Red tasks write failing tests for the listed spec
scenarios and stop; green tasks make them pass with the minimum code that respects `design.md`.
Requires `bootstrap-mvp` applied. Independent of `context-inheritance`; if it is already applied,
reuse `api/types/node-path.ts` and `schema/is-reserved-path.ts`. Scenario names refer to
`specs/<capability>/spec.md`.

## 1. Pure helpers

- [x] 1.1 Red — direct unit tests `test/shared/format-path-list.test.ts`: one path → "\`a\`";
      two → "\`a\` and \`b\`"; three → "\`a\`, \`b\` and \`c\`"; four → "\`a\`, \`b\`, \`c\` and
      \`d\`"; dotted paths kept verbatim. `test/rules/extract-backtick-references.test.ts`:
      returns path-like tokens in order of appearance (`age`, `address.city`, `$id`, `_x`);
      ignores `N/A`, `senior engineer`, `15 years`, empty backticks; deduplicates repeated tokens;
      returns `[]` when there are no backticks; unbalanced backtick yields no token.
- [x] 1.2 Green — `src/shared/format-path-list.ts`, `src/rules/{is-path-like-token,extract-backtick-references}.ts`.

## 2. Binding validation

- [x] 2.1 Red — `test/api/cross-field-define.test.ts`: `cross-field-rules` `Cross-field binding`
      scenarios (two-path, nested and object paths, single path, empty paths, duplicate paths,
      unknown declared path, on/through array, transformed node, missing rule, same rule object
      in two bindings, default id joins the paths, duplicate id across field and cross-field,
      shared path with a field rule — `define` succeeds) and `Backtick references` scenarios
      (declared compile, undeclared rejected with token in message, criteria validated, nested
      reference, parent object reference, non-path-like ignored, field rules not scanned).
- [x] 2.2 Green — `src/api/types/{cross-field-binding,node-path}.ts` (create `node-path` only if
      absent); `schema/resolve-node` gains an `allowObject` option; binding validation, id
      derivation (`paths.join("+")`), duplicate-id check across both rule kinds and reference
      validation in `api/define-semantic-schema.ts`. Export `CrossFieldBinding` (and `NodePath`
      if new) from `src/index.ts`.

## 3. Compilation and state

- [x] 3.1 Red — `test/fixtures/age-occupation/{es,en}.json` with `positive`, `negative`,
      `ambiguous` arrays of `{ age, occupation }` (≥ 4 each; negatives include `age: 7` with a
      senior occupation and an adversarial occupation string). `test/api/cross-field-parse.test.ts`:
      `compilation` `Cross-field question template` scenarios (two, one, three paths; nested
      keep dots; criteria; snapshot for the PDR rule) and `Cross-field rules share the object
request` scenarios (one request, union state, shared path once, excluded rule contributes
      no paths, two bindings keep order); `cross-field-rules` `State restriction and exclusion`
      "Cross-field-only schema sends exactly the declared paths", "Nested declared paths mirror
      structure", "Object path sends the sub-object".
- [x] 3.2 Green — `src/compiler/{cross-field-question-template,build-cross-field-question}.ts`;
      `build-state` accepts a set of paths from both rule kinds; `compile-request` orders field
      rules then bindings. Commit the new snapshot after reviewing wording; confirm bootstrap
      snapshots are untouched.

## 4. Exclusion and adversarial values

- [x] 4.1 Red — extend `test/api/cross-field-parse.test.ts`: "Shape failure on a declared path
      disables the rule", "Only rule disabled means zero calls", "Root Zod issue disables
      cross-field rules", "Nullish declared value skips the rule", "Surviving declared node
      receives its Zod output when a sibling failed", "Array-index Zod issues coexist with
      cross-field issues"; `User values never enter a cross-field question` scenarios
      (adversarial occupation, numeric value not interpolated).
- [x] 4.2 Green — per-declared-path exclusion (prefix check against every declared path), node
      re-parse for each declared node in the failure branch, nullish skip in
      `api/run-safe-parse.ts`.

## 5. Attribution in the result

- [x] 5.1 Red — `test/api/cross-field-result.test.ts`: `result` MODIFIED "Field-rule issue has no
      paths key", "Cross-field issue carries paths"; ADDED `Cross-field issue attribution`
      scenarios (one issue per declared path, identical except path, nested paths become arrays,
      single-path binding, warning fans out, severity applies to every issue, custom message
      applies to every issue, unavailable fans out per path, ordering with field rules, success
      false once).
- [x] 5.2 Green — `Issue.paths?` in `src/result/types/issue.ts`; `semantic-issue` and
      `unavailable-issue` accept `paths`; `assemble-result` fans out per declared path and orders
      field-rule issues before binding issues.

## 6. Type tests

- [x] 6.1 Red — `test/types/cross-field.test-d.ts`: `Type-level contract` scenarios (valid tuple,
      unknown path, array path, empty tuple, `crossField` optional) and `Issue["paths"]` is
      `(string | number)[][] | undefined`.
- [x] 6.2 Green — adjust `CrossFieldBinding<T>` / `NodePath<T>` until `yarn typecheck` and
      `vitest --typecheck` pass.

## 7. Eval, surface, docs, roadmap

- [x] 7.1 `test/eval/age-occupation.eval.test.ts`: `describe.skipIf(!process.env.TYPESAFE_API_KEY)`;
      positives `≥ 0.6` (or no issue), negatives `≤ 0.4`, ambiguous listed only. Run once locally
      with a key.
- [x] 7.2 Assert `test/api/public-surface.test.ts` is unchanged and green (no runtime symbol).
- [x] 7.3 README: "Cross-field rules" section — binding example (PDR age/occupation), backtick
      references and the `unknown_reference` guard, one issue per declared path with `paths` and
      `ruleId` for deduplication, nullish skip note, arrays not supported.
- [x] 7.4 `openspec/roadmap.md`: change 3 status. `openspec validate --all` and `yarn verify`.
