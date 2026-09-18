## Why

`bootstrap-mvp` sends Jev the bare values. Without context, "asdfasdf" is judged as a name in a
vacuum and a plausible Bolivian name may be judged by a US-centric prior. Constitution §3.8 and
§5.2 require every rule to receive a minimal context inherited `instance → schema → node → rule`
with a deterministic merge; that is the foundation `cross-field-rules`, `node-validation` and
`evaluation-harness` build on. This change adds it without changing any runtime export.

## What Changes

- `Context` type: a free-text string or an object with the reserved keys `domain`, `purpose`,
  `audience`, `locale`, `channel` (strings), an optional `notes: string[]` and open user keys. A
  string is sugar for `{ notes: [string] }`.
- Four attachment levels, all optional:
  - `createEDcheck({ context })` — instance;
  - `define(schema, { context })` — schema;
  - `define(schema, { nodeContext: { "address": …, "address.street": … } })` — node, keyed by
    object or leaf path, validated at `define` time;
  - `semantic({ intent, context })` — rule.
- Deterministic merge: structured keys shallow-merge with the most specific level winning; `notes`
  accumulate in inheritance order and never override structured keys. Resolved once per rule at
  `define` time.
- Compilation: surviving rules are grouped by identical effective context. Uniform context (the
  common case) still yields exactly one request per validated object (§4.8). Distinct rule-level
  contexts yield one request per group; each group's `state` carries only that group's fields plus
  a `context` key. Groups run concurrently under one signal and timeout; a failing group produces
  `semantic_unavailable` only for its own rules.
- The top-level state key `context` is reserved: a rule or node path starting with `context` is a
  configuration error.
- `locale` is context, not a filter (§3.11): it changes nothing but `state.context`.
- Instructions and criteria are unchanged; context travels only in `state`.

## Capabilities

### New Capabilities

- `context`: context forms and validation, the four attachment levels, the merge algorithm and its
  precedence, reserved keys, the reserved `context` state key, and the guarantee that context never
  enters instructions.

### Modified Capabilities

- `compilation`: "One request per validated object" becomes "one request per context group"; a
  new requirement fixes the shape of `state.context` and its snapshot.

## Impact

- **Public API — runtime symbols:** none added or changed; the public-surface list is untouched.
- **Public API — types:** new `Context`, `ContextObject`; new `NodePath<T>`; `EDcheckOptions.context`,
  `SemanticSchemaOptions.context`, `SemanticSchemaOptions.nodeContext`, `SemanticRuleOptions.context`
  added as optional fields. All additive.
- **Modules:** new `context/` (constitution §11: imports only `shared/`); `compiler/` gains group
  planning; `api/` resolves effective context at `define`; `rules/` accepts and copies `context`.
- **New error codes on `EDcheckConfigError`:** `invalid_context`, `reserved_path`.
- **Dependencies:** none. No new devDependency.
- **Tests:** direct unit tests for `context/` (explicitly allowed by §12.1.4); behavior through
  `safeParse` with the mock provider; payload snapshots gain a context variant; type tests for the
  four levels.
- **Docs:** README section on context; roadmap status.
- **Not in this change:** per-call context override in `safeParse` (no roadmap demand; additive
  later), redaction/exclusion controls, context for cross-field state (change 3), node-level
  validation reusing the resolved chain (change 4).
