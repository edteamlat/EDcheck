## Context

`bootstrap-mvp` binds rules to leaf paths (`rules: { fullName: semantic(…) }`), compiles one
request per object with `state = { <path>: value }` restricted to surviving rules, and emits one
issue per failing rule at the rule's path. Constitution §4.12 fixes cross-field as "explicit list
with declared `paths`"; §5.3 sets the state to "containing object restricted to declared `paths`";
§5.3 also says instructions reference fields by path with backticks; §10 expects the age/occupation
rule to emit an issue "on those paths". Bootstrap D4 keeps arrays out of v1.

## Goals / Non-Goals

**Goals:**

- Cross-field rules with typed, validated paths, reusing the `semantic()` rule object unchanged.
- No extra provider request: cross-field rules ride in the object request.
- Deterministic attribution to every declared path with enough metadata for forms and code.
- Catch the most common authoring bug — referencing a field that is not in the state — at
  `define` time.

**Non-Goals:**

- Attaching rules to nested containers with relative paths. Paths are absolute from the root.
- Letting Jev decide which path is at fault (§4.12 rationale).
- Object-node rules inside the `rules` map; a single-path cross-field binding covers that case.
- Array items, per-item fan-out, `paths` inside the rule object.

## Decisions

### D1. Binding shape: `crossField: [{ paths, rule }]`

```ts
edcheck.define(Person, {
  rules: { fullName: semantic("A plausible full name for a real person") },
  crossField: [
    {
      paths: ["age", "occupation"],
      rule: semantic({
        intent: "The `occupation` is plausible for someone of the given `age`",
        invalid: "The `occupation` requires more years than the `age` allows",
        id: "occupation_age_coherence",
      }),
    },
  ],
});
```

- The rule stays schema-agnostic and frozen; the binding carries the typed paths. Mirrors the
  `rules` map, where the key carries the path.
- `paths` is a non-empty readonly tuple of `NodePath<T>`; duplicates and empty lists are
  `invalid_paths`. A single path is allowed: it is how a rule attaches to a nested object as a
  whole (`paths: ["address"]`).
- Rejected: `semantic({ paths })`. Paths would be untyped strings and the rule would no longer be
  reusable across schemas.
- Rejected: a joined key in `rules` (`"age+occupation"`). Stringly typed, no tuple typing.
- Rejected: a `crossField(paths, statement)` builder export. Adds a runtime symbol for what an
  object literal expresses.

### D2. Path targets

Each declared path resolves with `schema/resolve-node` exactly like rule paths, except object
nodes are accepted (the whole sub-object is sent). `unknown_path`, `unsupported_node` (array,
through array, `pipe`, other non-primitive non-object) and `reserved_path` (if
`context-inheritance` is present) apply unchanged. A path that is also a field-rule path is
allowed; the value appears once in `state`.

### D3. Backtick references are validated

`rules/extract-backtick-references.ts` scans `intent`, `valid` and `invalid` for `` `token` ``.
A token is path-like when it matches `/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/`. Every path-like
token MUST be one of the declared paths, else `EDcheckConfigError` `unknown_reference` naming the
token. Tokens with spaces, slashes or other characters (`` `N/A` ``, `` `senior engineer` ``) are
ignored.

- Rationale: Jev reads literally; a reference to a field absent from `state` is always a bug.
- Rejected: no validation (silent wrong judgments). Rejected: strict validation of every backtick
  (breaks literal quoting in statements).
- Field rules are not scanned: their template fixes the single reference.

### D4. Cross-field rules join the object request; state is a union

- `state` = fields of surviving field rules ∪ declared paths of surviving cross-field rules,
  mirroring structure. A cross-field-only schema sends exactly the declared paths.
- One request per object is preserved (§4.8). Minimization is at the object level, as bootstrap
  already does for field rules sharing one state.
- Rejected: one request per cross-field rule with its own minimal state. N requests for one object
  contradicts §4.8 and §10 ("object with 6 rules → a single provider request"); the marginal
  relevance loss from a few extra sibling fields is small for objects this size.
- With `context-inheritance` applied, the cross-field rule's effective context is
  `instance → schema → rule` (no node level; the rule is bound to the root) and it joins the group
  with the matching `groupKey`.

### D5. Exclusion and value resolution

- A rule is excluded when any Zod issue path is a prefix of any declared path (root issue excludes
  all).
- In the shape-failure branch, each declared node is re-parsed from the raw value (bootstrap D6
  step 3); if any re-parse fails, the rule is excluded.
- If any declared value is `undefined` or `null`, the rule is skipped without an issue. Rejected:
  sending partial state. "Plausible given `age`" is unanswerable without `age`; partial evidence
  would produce unexplained outcomes. Deterministic presence checks belong to Zod `refine`.

### D6. Question template

```
Is the following statement true about <path list>? <intent>
```

`<path list>` is the declared paths in declared order, each in backticks, joined as `` `a` ``,
`` `a` and `b` ``, `` `a`, `b` and `c` `` (`shared/format-path-list.ts`). `criteria` from
`valid`/`invalid` as for field rules. Question key = rule id. Questions order: field rules in map
order, then cross-field bindings in array order.

- The template names the paths so Jev knows which state keys matter even when the intent phrases
  them loosely.
- Rejected: intent verbatim (no anchoring to the state keys). Rejected: reusing the field template
  ("Does `x` fit…") — grammatically wrong for propositions about several fields.

### D7. Rule id

Explicit `id`, else declared paths joined with `+` (`age+occupation`, `address.city+address.country`).
`duplicate_rule_id` applies across field and cross-field rules together. Rejected: positional ids
(`crossField[0]`) — unstable under reordering.

### D8. Attribution: one issue per declared path

For a `warning`/`fail` outcome (and for `semantic_unavailable`) the rule emits one issue per
declared path, in declared order. Issues are identical except for `path`, and every one carries
`paths: <all declared paths in array form>`. Field-rule issues have no `paths` key.

- Forms map issues by `path`; code deduplicates by `ruleId`; either consumer gets the full picture
  from any single issue via `paths`.
- `success` semantics are unchanged: any `severity: "error"` issue makes it `false`; the fan-out
  does not change the boolean.
- Ordering in `result.issues`: Zod issues, then field-rule issues in map order, then cross-field
  issues in binding order (each binding's issues in declared-path order).
- Rejected: a single issue at `[]` with a `paths` list. Forms cannot place it without custom code
  and §10 expects issues on the declared paths.
- Rejected: a single issue at the first declared path. Arbitrary; hides the other fields.

### D9. Types

- `api/types/cross-field-binding.ts`:
  `type CrossFieldBinding<T> = { readonly paths: readonly [NodePath<T>, ...NodePath<T>[]]; readonly rule: SemanticRule }`.
- `api/types/node-path.ts` (create if `context-inheritance` has not): every dotted path of
  `z.output<S>` that does not cross an array, objects included.
- `SemanticSchemaOptions<T>.crossField?: readonly CrossFieldBinding<T>[]`.
- `result/types/issue.ts`: `paths?: (string | number)[][]`.
- Exported types: `CrossFieldBinding`, `NodePath` (if new).

### D10. Modules touched

| Module      | Files                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/`   | `format-path-list`                                                                                                                                                     |
| `rules/`    | `extract-backtick-references`, `is-path-like-token`                                                                                                                    |
| `schema/`   | none new (`resolve-node` reused, object nodes accepted through an `allowObject` flag)                                                                                  |
| `compiler/` | `cross-field-question-template` (constant), `build-cross-field-question`; `build-state` accepts both rule kinds; `compile-request` orders field then cross-field       |
| `result/`   | `semantic-issue` and `unavailable-issue` accept `paths`; `assemble-result` fans out per declared path                                                                  |
| `api/`      | `types/cross-field-binding`, `types/node-path`; `define-semantic-schema` validates bindings, references and ids; `run-safe-parse` computes exclusion per declared path |

### D11. Test strategy

- **Through the public entry** (`test/api/cross-field-*.test.ts`): binding validation errors;
  reference validation; state union and exactness; template and snapshot for the PDR rule;
  exclusion on a declared path; nullish skip; adversarial value; attribution fan-out; ordering;
  `semantic_unavailable` fan-out; interaction with field rules in one request.
- **Direct unit tests**: `test/shared/format-path-list.test.ts` (1, 2, 3, 4 paths) and
  `test/rules/extract-backtick-references.test.ts` (path-like vs ignored tokens, nested paths,
  duplicates, none). Pure string logic with many cases.
- **Type tests** (`test/types/cross-field.test-d.ts`): tuple typing, unknown path, array path,
  object path accepted, empty tuple rejected, `Issue.paths` optional.
- **Snapshots**: new snapshot `age-occupation`; bootstrap snapshots unchanged.
- **Fixtures** `test/fixtures/age-occupation/{es,en}.json`: objects `{ age, occupation }` in
  `positive`, `negative`, `ambiguous`, including an adversarial occupation string.
- **Eval**: extend `test/eval/` with `age-occupation.eval.test.ts`, skipped without a key, bands
  `≥ 0.6` / `≤ 0.4`.
- **Mock only**: every behavior test uses `mockProvider`; the provider-failure fan-out uses
  `mockProvider({ error })`.

## Risks / Trade-offs

- [Issue count inflates with many declared paths] → `ruleId` and `paths` make deduplication
  trivial; documented in README.
- [Reference validation false positives on legitimately backticked words] → heuristic ignores
  tokens with spaces or punctuation; authors can drop backticks for non-paths.
- [Union state sends a field rule's value to a cross-field question and vice versa] → same as
  bootstrap's shared object state; accepted for one-request semantics; `evaluation-harness`
  measures.
- [Skipping on any nullish declared value hides "missing data" cases] → those are deterministic
  and belong to Zod `refine`; documented.
- [Two independent changes (2, 3) both introduce `NodePath<T>`] → identical definition in both
  designs; the second applier reuses the file.

## Migration Plan

Additive. Existing bound schemas without `crossField` behave identically; field-rule issues gain
no new key.

## Open Questions

None.
