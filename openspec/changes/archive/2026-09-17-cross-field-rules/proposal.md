## Why

`bootstrap-mvp` judges one field at a time. The PDR's third acceptance scenario — `age: 7` with
`occupation: "Senior engineer, 15 years"` — is invisible to field rules because each value is
plausible alone. Constitution §4.12 locks the answer: cross-field rules with an explicit list of
declared `paths`, because Jev does not produce reliable paths itself. This change adds those rules
on top of the bootstrap pipeline without a new runtime export and without changing the one-request
per-object guarantee.

## What Changes

- `define(schema, { crossField: [{ paths, rule }] })`: a cross-field binding attaches a reusable
  `semantic(...)` rule to the root object with one or more typed dotted paths (primitive leaves or
  nested objects; never arrays or transforms). Validated at `define` time.
- Statements reference fields with backticks (`` `occupation` ``). Backticked path-like tokens in
  `intent`, `valid` and `invalid` MUST be declared paths; an undeclared reference is a
  configuration error.
- Compilation: cross-field rules join the object's single request. `state` is the union of the
  surviving field-rule paths and the surviving cross-field declared paths, mirroring structure; a
  schema with only cross-field rules sends exactly the declared paths. Question template:
  ``Is the following statement true about `age` and `occupation`? <intent>``.
- Exclusion: a Zod issue on any declared path disables the rule; any declared value that is
  `undefined`/`null` skips the rule silently.
- Result: one issue per declared path, in declared order, identical except for `path`, each
  carrying `paths` (all declared paths in array form). `semantic_unavailable` follows the same
  fan-out. Default rule id is the declared paths joined with `+` (`age+occupation`).
- New `EDcheckConfigError` codes: `invalid_paths`, `unknown_reference`.

## Capabilities

### New Capabilities

- `cross-field-rules`: the binding, path and reference validation, state restriction, exclusion
  rules, adversarial guarantee and type-level contract.

### Modified Capabilities

- `compilation`: adds the cross-field question template and the union-state requirement. ADDED
  only; the bootstrap requirements are not rewritten (avoids a delta conflict with
  `context-inheritance`, which modifies "One request per validated object").
- `result`: "Semantic issue shape" gains an optional `paths` field; a new requirement defines
  cross-field attribution and ordering.

## Impact

- **Public API — runtime symbols:** none. The public-surface list is untouched.
- **Public API — types:** `SemanticSchemaOptions.crossField?: CrossFieldBinding<T>[]`,
  `CrossFieldBinding<T> = { paths: readonly [NodePath<T>, ...NodePath<T>[]]; rule: SemanticRule }`,
  `Issue.paths?: (string | number)[][]`. `NodePath<T>` is shared with `context-inheritance`;
  whichever change is applied first creates `api/types/node-path.ts` with the identical definition.
- **Modules:** `api/` (binding validation, orchestration), `compiler/` (cross-field template, union
  state), `result/` (fan-out per path), `rules/` (backtick reference extraction), `shared/`
  (`format-path-list`). No new module.
- **Dependencies:** none.
- **Tests:** behavior through `safeParse` with the mock; a new payload snapshot for the PDR
  age/occupation rule; type tests; fixtures `test/fixtures/age-occupation/{es,en}.json` and a
  smoke-eval case, skipped without a key.
- **Interaction with `context-inheritance` (independent, may land before or after):** a
  cross-field rule's effective context is `instance → schema → rule`; node contexts do not apply.
  Cross-field rules join the request group whose context matches theirs.
- **Consequence of bootstrap D4 (arrays out of v1):** a declared path through an array is rejected
  at attach time. The roadmap's "array indices attribute correctly" is satisfied by Zod passthrough
  (`["tags", 1]`) coexisting with cross-field issues, and by nested paths (`["address", "city"]`).
- **Not in this change:** rules on nested containers with relative paths, attribution weights
  (which path is "more" at fault), `paths` on the rule object itself, object-node field rules in
  the `rules` map.
