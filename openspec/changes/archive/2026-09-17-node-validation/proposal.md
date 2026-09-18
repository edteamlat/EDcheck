## Why

Forms validate one field at a time ("on blur"), then the whole object on submit. Today the only
entry is `SemanticSchema.safeParse(wholeObject)`, so a field-level check must either send the whole
object (cost, irrelevant state, §7) or bypass EDcheck. Constitution §13.5 leaves open the signature
of node-level validation and how it preserves inherited context. This change closes it with a
bound node handle that reuses the exact pipeline, context resolution and result shape of
whole-object validation.

## What Changes

- `SemanticSchema.node(path)` returns a memoized `SemanticNode` for a leaf or object path of the
  bound schema (`NodePath<T>`, no arrays). Path errors are thrown at `node()` time with the same
  codes as rule paths (`unknown_path`, `unsupported_node`, `reserved_path`).
- `SemanticNode.safeParse(value, { signal?, timeoutMs? })` validates the node's shape with its
  resolved Zod node, runs the field rules whose path is the node or under it, plus cross-field
  rules whose declared paths all lie under the node, and returns a `SemanticResult` whose `data` is
  the node's Zod output and whose issue `path`s are absolute (prefixed with the node path).
- The compiled request for a node equals the whole-object request restricted to that node's rules:
  same `state` shape, same effective context (resolved at `define`), same grouping, same question
  text. Byte-identical payloads are asserted.
- Cross-field rules with a declared path outside the node are skipped silently; `SemanticNode.ruleIds`
  exposes which rules the node runs.
- Race semantics: concurrent `safeParse` calls on the same node are independent; each result
  corresponds to its own value; a cancelled call never emits a result. The library does not
  supersede in-flight calls (a shared server instance would cancel other requests' work).
- `SemanticNode.path` (array form) and `SemanticNode.schema` (the resolved Zod node) are exposed.

## Capabilities

### New Capabilities

- `node-validation`: node handle construction, rule selection, node pipeline (shape, exclusion,
  nullish skip, state, context, grouping), result shape, cancellation and concurrency, type
  contract.

### Modified Capabilities

None. The `schema-binding`, `compilation`, `result` and `outcome-policy` requirements apply to node
parses unchanged; the new spec references them rather than restating them.

## Impact

- **Public API — runtime symbols:** none. `node` is a method on the existing `SemanticSchema`.
- **Public API — types:** `SemanticNode<S, P>`, `PathValue<T, P>`; `SemanticSchema` gains `node`.
- **Modules:** `api/` gains `create-semantic-node`, `run-node-parse` and the shared `run-rules`
  extracted from `run-safe-parse` (steps 3–8 of the pipeline become one function used by both
  entries); `schema/` gains `select-rules-under-path`; `result/` gains `prefix-issue-paths`.
- **Refactor:** `run-safe-parse` delegates to `run-rules`. Existing behavior tests stay untouched
  (§12.1.4).
- **Tests:** `test/api/node-validation.test.ts` through the public entry with `mockProvider` and
  one hand-written provider for the ordering race; type tests in
  `test/types/node-validation.test-d.ts`; one new payload snapshot compared against the
  whole-object snapshot.
- **Docs:** README section "Validate one field" with the on-blur example and the note on
  cross-field rules.
- **Depends on:** `context-inheritance` (uses `NodePath`, per-rule effective context, `plan-groups`).
  Cross-field scenarios run only when `cross-field-rules` is applied; Score rules need nothing
  specific.
- **Not in this change:** per-call context, supersession/latest-only helpers, passing sibling
  values to complete cross-field rules from a node, relative paths, arrays.
