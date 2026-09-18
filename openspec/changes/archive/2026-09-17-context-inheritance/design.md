## Context

`bootstrap-mvp` (proposed) fixes the API: `createEDcheck` → `define` → `safeParse`, one request
per validated object, `state = { <path>: value }` restricted to surviving rules, questions
`Does \`<path>\` fit the following description? <intent>`. Constitution §5.2 defines context as a
string or an object with reserved keys, inherited `instance → schema/object → node → rule`, objects
shallow-merged with the most specific level winning, strings accumulated in `notes[]`that never
override structured keys. §5.3 puts context inside`state`. §6.5 says rules with identical state
form one request; a whole object is usually one group. §7 warns that Jev loses accuracy with
irrelevant state, hence minimization (§3.8).

## Goals / Non-Goals

**Goals:**

- Context at four levels with a deterministic, testable merge resolved at `define` time.
- Context inside `state`, never in `instructions`/`criteria`.
- Preserve "one request per object" when context is uniform; split only when rule-level contexts
  actually differ, and keep every group's state minimal.
- No runtime export added; all type changes additive.

**Non-Goals:**

- Per-call context (`safeParse(data, { context })`). Additive later if a use case appears.
- Unsetting an inherited key from a more specific level (`null`/`undefined` semantics).
- Redaction, PII exclusion, context serialization formats other than the JSON object in `state`.
- Cross-field/object-node state (change 3) and node-level validation (change 4); they reuse the
  resolved chain built here.
- Any change to the question template wording.

## Decisions

### D1. Context model and normalization

```ts
type ContextObject = {
  domain?: string;
  purpose?: string;
  audience?: string;
  locale?: string;
  channel?: string;
  notes?: string[];
  [key: string]: unknown;
};
type Context = string | ContextObject;
```

- Normalization: `string` → `{ notes: [string] }`. An object is shallow-copied and its `notes`
  array copied, so later mutation of the caller's object does not leak into the rule/schema.
- Validation (`EDcheckConfigError`, code `invalid_context`): empty or whitespace-only string;
  non-object non-string; a reserved key present with a non-string value; `notes` present but not an
  array of non-empty strings; a key whose value is `undefined` is ignored (JS callers), any other
  value is kept as-is and MUST be JSON-serializable (documented, not deep-validated).
- Rejected: only strings (PDR basic path) — no predictable merge. Rejected: closed shape — apps
  need domain keys (`tenant`, `plan`).
- Rejected: treating a user-provided `notes` as an error. It is the natural way to give several
  free-text segments at one level and makes the string form pure sugar.

### D2. Attachment levels and their API

| Level    | API                                                      | Notes                                                       |
| -------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| instance | `createEDcheck({ context })`                             | Validated at creation.                                      |
| schema   | `define(schema, { context })`                            | Validated at `define`.                                      |
| node     | `define(schema, { nodeContext: { "<path>": Context } })` | Path may be an object or a leaf; validated like rule paths. |
| rule     | `semantic({ intent, context })`                          | Not available on the basic string form.                     |

- `nodeContext` paths are resolved with the same `schema/` machinery as rules: unknown →
  `unknown_path`; array or through array → `unsupported_node`; `pipe` → `unsupported_node`. Object
  paths are valid targets here (unlike rule paths).
- Rejected: node context on Zod `.describe()`/`.meta()`. Same reasons as bootstrap D1.
- Rejected: a `nodes: { path: { context } }` options bag. Nothing else lives per node yet
  (thresholds precedence has no node level); a flat map is simpler and can be wrapped later.

### D3. Merge algorithm (normative, implemented in `context/merge-contexts.ts`)

Input: an ordered list of normalized `ContextObject`s: `[instance, schema, ...nodeAncestors, rule]`
where `nodeAncestors` are the `nodeContext` entries whose path is a prefix of (or equal to) the
rule path, ordered from the root-most to the rule's own path. Missing levels are skipped.

```
effective = {}
notes = []
for each level in order:
  for each key in level (insertion order) except "notes":
    effective[key] = level[key]          // later level wins
  notes.push(...level.notes ?? [])
if notes.length > 0: effective.notes = notes
```

- Structured keys: last writer wins; the winner is the most specific level. Key insertion order
  is the first level that introduced the key, so the object is deterministic for snapshots.
- `notes` is always emitted last and only when non-empty.
- A string context at any level only appends a note; it cannot override a structured key.
- The empty effective context `{}` is treated as "no context": `state` gets no `context` key,
  which keeps every bootstrap payload snapshot valid.
- Rejected: deep merge. Open keys are opaque to the library; deep semantics would surprise.
- Rejected: node contexts contributing only for the exact rule path. Object-level context
  (`address`) must reach `address.street` — that is what "node" means for nested schemas.

### D4. Resolution happens at `define` time

All four levels are known when `define` runs. The bound schema stores, per rule, its effective
context and a `groupKey` (stable JSON of the effective context with sorted keys, from
`shared/stable-stringify.ts`). `safeParse` does no merging; it filters surviving rules and buckets
them by `groupKey`. Rejected: resolving per call. Repeated work, and per-call context is a
non-goal.

### D5. Grouping and state shape

- Surviving rules are grouped by `groupKey`. Each group compiles to one `SemanticRequest`:
  `state = { <fields of the group's rules, mirroring structure>, context?: EffectiveContext }`;
  `questions` = the group's rules in declaration order.
- Uniform context → one group → exactly one request (§4.8 preserved). The split only happens when
  rule- or node-level contexts differ, which §6.5 anticipates; this does not reopen §4.8.
- Groups are ordered by the declaration index of their first rule, so payload snapshots and
  `mock.calls` order are deterministic.
- Groups execute concurrently (`Promise.all`) under the single combined signal and one `timeoutMs`.
  A rejected group produces `semantic_unavailable` for its own rules only; other groups' outcomes
  stand. A caller abort rejects the whole parse (bootstrap D6 unchanged).
- Rejected: one request with a per-field context nested in state
  (`{ fields: { fullName: { value, context } } }`). Every question would see every other rule's
  context (irrelevant state, §7) and the template would have to change.
- Rejected: union of all contexts in one request. Conflicting `audience` values would be silently
  merged.

### D6. Reserved `context` state key

`state.context` is reserved. At `define`, a rule path or `nodeContext` path whose first segment is
`context` throws `EDcheckConfigError` with code `reserved_path`. This applies even when no context
is configured, so behavior does not change when a context is added later. Rejected: a prefixed key
(`$context`). Jev reads state literally; `context` is the readable, self-describing name.

### D7. Instructions unchanged

The question template is not modified and no "consider `context`" hint is appended. Context is
data in `state` under a self-describing key; the template stays literal and short. A wording
experiment belongs to `evaluation-harness`, where it can be measured. Consequence: with an empty
effective context, compiled payloads are byte-identical to bootstrap's.

### D8. Modules and boundaries

- `context/` (new; imports only `shared/`): `normalize-context`, `merge-contexts`,
  `is-empty-context`, `reserved-context-keys` (constant), `types/context`, `types/context-object`,
  `types/effective-context`.
- `shared/`: `stable-stringify`.
- `rules/`: `SemanticRuleOptions.context`; `normalize-rule` validates and copies it.
- `schema/`: `resolve-node` reused for `nodeContext` paths; a new `is-reserved-path`.
- `compiler/`: `plan-groups` (bound rules + surviving set → ordered groups); `build-state` adds
  the `context` key; `compile-request` takes a group.
- `api/`: `create-edcheck` validates instance context; `define-semantic-schema` validates schema
  and node contexts, resolves the effective context and `groupKey` per rule; `run-safe-parse`
  buckets and runs groups concurrently; `types/node-path` (`NodePath<T>`: every dotted path of
  `z.output<S>` that does not cross an array, objects included).
- Public types added to `index.ts`: `Context`, `ContextObject`, `NodePath`. No runtime symbol.

### D9. Test strategy

- **Direct unit tests** (`test/context/`), allowed by §12.1.4 for `context/` merge: normalization
  and validation table; merge precedence across all four levels; notes accumulation order; string
  never overrides structured keys; key insertion order; empty result. These are pure functions with
  many boundary cases.
- **Through the public entry** (`test/api/context.test.ts`): every attachment level lands in
  `mock.calls[n].state.context`; inheritance for a rule with no context; three-level conflict;
  ancestor node ordering; `nodeContext` path errors; `reserved_path`; instructions identical with
  and without context; `locale` does not filter; grouping (two distinct rule contexts → two calls
  with minimal states; a failing group isolates its `semantic_unavailable`; abort rejects whole
  parse); `mock.calls` snapshot for the `full-name` fixture with the PDR project context.
- **Type tests** (`test/types/context.test-d.ts`): `Context` accepted at the four levels;
  `nodeContext` keys are `NodePath<T>` (object path accepted, unknown path and array path rejected);
  reserved key with a number is rejected; open keys accepted.
- **Provider mock only.** The failing-group scenario uses a hand-written provider that throws
  `EDcheckProviderError` when `request.state.context?.audience === "x"`; it is still the provider
  boundary.
- **Snapshots:** the bootstrap snapshot must stay unchanged (D7 consequence, asserted by not
  updating it); one new snapshot with context.
- **Eval:** none new. `evaluation-harness` measures context wording.

## Risks / Trade-offs

- [Distinct rule contexts silently multiply requests and cost] → groups are deterministic and
  visible in `mock.calls`; README documents "identical context = one request";
  `observability-hooks` exposes request count.
- [Open keys hold non-serializable values] → documented as JSON-serializable; `JSON.stringify` in
  the adapter drops functions/undefined; a `stable-stringify` failure (cyclic) surfaces as a
  `EDcheckConfigError` `invalid_context` at `define`.
- [Snapshot churn when adding context to existing fixtures] → empty context leaves payloads
  byte-identical; new fixtures get their own snapshots.
- [`NodePath<T>` doubles type-level path computation] → same recursion as `FieldPath<T>` with
  objects included; covered by the three-level type test.

## Migration Plan

Additive. No consumer changes. Existing bound schemas behave identically.

## Open Questions

None. Per-call context is deferred, not open.
