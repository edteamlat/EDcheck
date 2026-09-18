## Context

`bootstrap-mvp` D6 fixes the whole-object pipeline: shape → exclusion by invalid prefixes → node
re-parse for values → nullish skip → minimized `state` → one request → policy → result.
`context-inheritance` resolves each rule's effective context and `groupKey` at `define` and buckets
surviving rules by group; it also defines `NodePath<T>` (leaf or object path not crossing an
array). `cross-field-rules` binds rules to several declared paths. Bootstrap D1 chose the bound
schema as "the natural home for node-level validation". Constitution §13.5 asks for the signature
and how inherited context is preserved. EDcheck runs server-only, so a bound schema is normally a
module-level object shared by every HTTP request.

## Goals / Non-Goals

**Goals:**

- One field (or sub-object) validated with exactly the rules, context, state, questions and
  outcome mapping it would get inside a whole-object parse.
- Same `SemanticResult` shape; issue paths comparable with whole-object issues.
- Setup-time path errors; zero provider calls when no rule applies.
- Race and cancellation semantics that are safe on a shared server instance.

**Non-Goals:**

- Supersession / "latest only" helpers. See D6.
- Supplying sibling values so a partially covered cross-field rule can run from a node.
- Relative paths, array items, per-call context, validating several disjoint nodes in one call.

## Decisions

### D1. Signature (§13.5): `SemanticSchema.node(path).safeParse(value, options?)`

```ts
const FullName = UserSemantic.node("fullName");
const result = await FullName.safeParse(input.fullName, { signal });
// result: SemanticResult<string>

type SemanticNode<S extends z.ZodObject, P extends NodePath<z.output<S>>> = {
  readonly path: readonly string[]; // ["address", "street"]
  readonly schema: z.ZodType; // resolved node, wrappers kept
  readonly ruleIds: readonly string[]; // rules this node runs, declaration order
  safeParse(
    value: unknown,
    options?: ParseOptions,
  ): Promise<SemanticResult<PathValue<z.output<S>, P>>>;
};
```

- `node()` validates and resolves the path once (`schema/resolve-node`, same unwrapping as rule
  paths; object nodes allowed as in `nodeContext`), selects the rules, and memoizes the handle per
  bound schema in a `Map<string, SemanticNode>` keyed by the dotted path. `node("a")` twice returns
  the same object.
- `value` is `unknown`: the whole point is validating raw input. `data` is typed by the path.
- Rejected: `safeParseNode(path, value, options)` on the schema. Repeats path resolution per call
  and has no place for `ruleIds`/`schema`; the handle is what an on-blur handler wants to hold.
- Rejected: `define` on a sub-schema. Loses inherited context and cross-field rules; that is the
  problem §13.5 asks to solve.
- Rejected: root path (`""`) as a node. Whole-object parse already exists; `NodePath<T>` excludes
  it; `node("")` is `unknown_path`.

### D2. Path errors at `node()`

| Condition                                | Code               |
| ---------------------------------------- | ------------------ |
| Empty string or segment not in the shape | `unknown_path`     |
| Array node or path through an array      | `unsupported_node` |
| `pipe`/`transform` node                  | `unsupported_node` |
| First segment `context`                  | `reserved_path`    |

A node with zero rules is valid (`ruleIds: []`); `safeParse` then performs only the shape check
and never touches the provider. Rejected: config error on rule-less nodes — a generic on-blur
handler over every field must not need a rule map lookup first.

### D3. Rule selection (`schema/select-rules-under-path.ts`)

Given the bound rules and the node path `N`:

- Field rule with path `R`: selected iff `isPathPrefix(N, R)` (equal or under).
- Cross-field rule with declared `paths`: selected iff every declared path satisfies
  `isPathPrefix(N, path)`. Any declared path outside `N` → the rule is skipped, no issue, no
  request. Rationale: the sibling values are not available and guessing them would send stale or
  empty state; the whole-object parse on submit covers the rule. `ruleIds` makes the skip visible
  at setup.
- Order: declaration order as stored by `define`. `ruleIds` is frozen.

### D4. Node pipeline (`api/run-node-parse.ts`)

1. `node.schema.safeParse(value)` — the resolved node **with** its wrappers, so `.trim()`,
   `.default()`, `.optional()` apply exactly as inside the whole object (bootstrap D6.3).
2. Zod issues get their `path` prefixed with `N` (`result/prefix-issue-paths.ts`) so they are
   comparable with whole-object issues; `severity: "error"`.
3. Exclusion: the invalid-prefix set is computed from the prefixed issue paths; a selected rule is
   excluded when any issue path is a prefix of any of its paths (same `collect-invalid-prefixes`).
   For an object node with an invalid child, sibling rules still run.
4. Values: for surviving rules, read from the node's Zod output at the path relative to `N`
   (`getAtPath(output, R.slice(N.length))`). Nullish → rule skipped (bootstrap D6.3).
5. Steps 5–8 of bootstrap D6 run unchanged through the shared `api/run-rules.ts`: `plan-groups`
   by `groupKey`, `compile-request` with `state` mirroring the **absolute** structure, combined
   signal, provider, policy, assembly. Node parse contributes only "which rules and which values".
6. `data` is the node's Zod output; `success` follows the standard rule.

Consequence, asserted by test: for a schema whose only rule is on `fullName`, the request produced
by `node("fullName").safeParse(v)` deep-equals the one produced by `safeParse({ fullName: v })`.

### D5. Context preservation

Nothing is recomputed. `define` already stored, per rule, the effective context merged from
instance → schema → node ancestors → rule, and its `groupKey`. The node parse selects rules and
hands them to `run-rules`; `state.context` is therefore identical to the whole-object case, and
node-level contexts declared on ancestors of `N` (for example `nodeContext: { address: … }` when
validating `address.street`) are present. Rules with distinct contexts inside an object node form
distinct groups, as in the whole-object parse.

### D6. Concurrency and cancellation

- Each `safeParse` call is independent: its own combined signal, its own request(s), its own
  result. Two overlapping calls on the same handle with different values produce two provider
  requests whose states carry their own values, and each promise resolves with the outcome for its
  own value regardless of provider response order.
- Bootstrap's cancellation contract applies: a call whose caller signal is aborted rejects with
  `EDcheckAbortError` and emits nothing, even if the provider later resolves that request. Pre-
  aborted signal → reject without calling the provider. Timeout → `semantic_unavailable` per rule.
- Rejected: automatic supersession (a new call aborts the previous one on the same handle).
  The handle is memoized on a bound schema that is shared by every request of a server process;
  request B would cancel request A's validation of the same field. Deduplication belongs to the
  client. Rejected: an opt-in `supersede: true` — same footgun, one flag away; a later
  `createSession()`-style scope could add it safely if a use case appears.

### D7. Refactor: `run-rules`

`api/run-safe-parse.ts` currently owns steps 1–8. It is split into:

- `run-safe-parse.ts`: steps 1–4 for the whole object (shape, exclusion, value resolution).
- `run-rules.ts`: `({ rules: BoundRuleWithValue[], data, zodIssues, options }) → Promise<SemanticResult>`,
  steps 5–8, shared by both entries.
- `run-node-parse.ts`: steps 1–4 for a node (D4).

The refactor happens under the existing `test/api/**` suite, which must stay green without edits.

### D8. Types

- `PathValue<T, P extends string>` (`api/types/path-value.ts`): value type at a dotted path of
  `T`, unwrapping `optional`/`nullable` as Zod's output does (`z.output` already reflects
  `.default()`).
- `SemanticNode<S, P>` (`api/types/semantic-node.ts`). `SemanticSchema<S>` gains
  `node<P extends NodePath<z.output<S>>>(path: P): SemanticNode<S, P>`.
- Exported from `index.ts`: `SemanticNode`, `PathValue`. No runtime symbol.

### D9. Modules and boundaries

| Module    | Additions                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------ |
| `api/`    | `create-semantic-node`, `run-node-parse`, `run-rules`, `types/semantic-node`, `types/path-value` |
| `schema/` | `select-rules-under-path`                                                                        |
| `result/` | `prefix-issue-paths`                                                                             |

No change to `compiler/`, `policy/`, `context/`, `providers/`, `rules/`.

### D10. Test strategy

- **Public entry only** (`test/api/node-validation.test.ts`), `mockProvider` for answers, delays,
  errors and recorded calls. One hand-written provider for the ordering race: it resolves each
  request when the test releases it, answering by the value found in `request.state` — still the
  provider boundary.
- **Payload parity:** deep-equal `mock.calls[0]` between node parse and whole-object parse for a
  single-rule schema; the context fixture from `context-inheritance` re-run through `node()`.
- **Adverse cases:** invalid node value (provider not called, absolute issue path); object node
  with one invalid child (sibling evaluated, invalid child's rule excluded); nullish optional
  (no request); `.default()` and `.trim()` applied to the evaluated value; empty/huge/emoji/RTL
  strings pass through `state` unchanged; `passthrough()` object node keeps unknown keys in
  `data`; rule-less node; cross-field partial/complete coverage; every path error code; memoized
  handle identity.
- **Race/cancellation:** pre-aborted; abort in flight with the provider later resolving (result
  never emitted, no `unhandledRejection`); two overlapping calls, one aborted, the other resolves;
  two overlapping calls resolved by the provider in reverse order, each result matches its own
  value; timeout under `open` and `closed`; per-call `timeoutMs` override.
- **Type tests** (`test/types/node-validation.test-d.ts`): leaf path → `SemanticResult<string>`;
  object path → sub-object type; optional leaf → `string | undefined`; unknown path, array path
  and `""` rejected with `@ts-expect-error`; `node` present on `SemanticSchema`; `SemanticNode`
  and `PathValue` exported.
- **Snapshots:** one new payload snapshot for the `full-name` fixture through `node("fullName")`,
  asserted equal to the existing whole-object snapshot content.
- **Eval:** none; the compiled question is unchanged.

## Risks / Trade-offs

- [Cross-field rules silently skipped from a node] → `ruleIds` exposes coverage; README states
  "cross-field rules run on submit"; whole-object parse remains the source of truth.
- [Refactor touches the hot path of `safeParse`] → behavior suite stays unchanged and must stay
  green; snapshots pin payloads.
- [Memoized handles hold resolved nodes for the lifetime of the schema] → bounded by the number of
  distinct paths, which is bounded by the schema.
- [Callers expect latest-only semantics] → documented pattern with `AbortController` in README;
  the cancellation tests prove the stale call cannot leak a result.
- [`PathValue` recursion cost on large schemas] → same depth as `NodePath<T>`; type tests on a
  three-level schema.

## Migration Plan

Additive. Existing `safeParse` behavior and payloads are unchanged.

## Open Questions

None. §13.5 is closed by D1 and D5.
