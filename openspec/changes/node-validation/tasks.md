Every task ends with `yarn verify` green. Red tasks write failing tests for the listed spec
scenarios and stop; green tasks make them pass with the minimum code that respects `design.md`.
Requires `bootstrap-mvp` and `context-inheritance` applied. Group 6 runs only when
`cross-field-rules` is applied. Scenario names refer to `specs/node-validation/spec.md`. All
behavior tests go through the public entry with `mockProvider`; the single hand-written provider is
described in design D10.

## 1. Pipeline refactor (no behavior change)

- [ ] 1.1 Red — none. The existing `test/api/**` suite and payload snapshots are the guard; they
      must stay green and unmodified through 1.2.
- [ ] 1.2 Green — extract `src/api/run-rules.ts` (steps 5–8 of bootstrap D6: `plan-groups`,
      `compile-request`, combined signal, provider, policy, assembly) from `run-safe-parse.ts`,
      which keeps steps 1–4 and delegates. Add `src/api/types/bound-rule-with-value.ts` for the
      hand-off shape. Run `yarn verify`; no snapshot may change.

## 2. Types

- [ ] 2.1 Red — `test/types/node-validation.test-d.ts` with `Node type contract` scenarios: "Leaf
      path types data", "Object path types data as the sub-object", "Optional leaf", "Invalid
      paths are rejected at compile time", "Exported types". Extend
      `test/api/public-surface.test.ts` assertion comment for "Public surface unchanged" (the
      list itself does not change).
- [ ] 2.2 Green — `src/api/types/path-value.ts`, `src/api/types/semantic-node.ts`;
      `SemanticSchema<S>` gains `node<P extends NodePath<z.output<S>>>(path: P): SemanticNode<S, P>`.
      Export the two types from `index.ts`. `node` may throw "not implemented" for now.

## 3. Handle construction and rule selection

- [ ] 3.1 Red — `test/api/node-validation.test.ts` with `Node handle construction` scenarios:
      "Leaf node handle", "Object node handle", "Handle is memoized", "Rule-less node is
      allowed", "ruleIds is frozen", "Unknown path", "Array path", "Pipe node", "Reserved path",
      "Wrappers are kept on the resolved node". `Rule selection for a node` field-rule scenarios:
      "Sibling rules are not selected", "Nested rules under an object node are selected"
      (these two need 4.2 to pass; write them now, they stay red until then).
- [ ] 3.2 Green — `src/schema/select-rules-under-path.ts` (field rules by `isPathPrefix`;
      cross-field rules by all-paths-under, when the bound schema carries them),
      `src/api/create-semantic-node.ts` (resolve via `resolve-node` with object nodes allowed,
      `reserved_path` check, frozen `ruleIds`, `Map` memoization on the bound schema).

## 4. Node pipeline

- [ ] 4.1 Red — extend `test/api/node-validation.test.ts` with `Node pipeline` scenarios: "Shape
      failure on the node", "Nested shape issue path is absolute", "Invalid child excludes only
      its rule", "Nullish value skips the rule", "Default value is evaluated", "Trimmed value is
      evaluated", "State mirrors the absolute structure", "Payload parity with whole-object
      parse", "Question text unchanged", "Extreme strings pass through", "Passthrough object node
      keeps unknown keys", "Outcome mapping applies", "Warning keeps success", "Rule-less node
      performs only the shape check". Add `test/fixtures/full-name` node payload snapshot and
      assert it equals the whole-object snapshot content.
- [ ] 4.2 Green — `src/result/prefix-issue-paths.ts`, `src/api/run-node-parse.ts` (D4 steps
      1–4, then `run-rules`). Wire `SemanticNode.safeParse`. Reuse `collect-invalid-prefixes`
      and `get-at-path`; no new path helpers.

## 5. Context preservation

- [ ] 5.1 Red — extend the suite with `Context preservation in node parses` scenarios: "Instance
      and schema context reach the node", "Ancestor node context reaches a nested node", "Rule
      context wins", "Context parity with whole-object parse" (reuse the `context-inheritance`
      payload fixture), "Distinct contexts inside an object node split requests", "Empty context
      adds no key".
- [ ] 5.2 Green — expected to pass with no new code because `run-rules` consumes the effective
      context stored at `define`; fix any leak found.

## 6. Cross-field selection (only when `cross-field-rules` is applied)

- [ ] 6.1 Red — extend the suite with `Rule selection for a node` cross-field scenarios:
      "Cross-field rule fully covered by the node", "Cross-field rule partially covered is
      skipped", "Node with only a partially covered cross-field rule".
- [ ] 6.2 Green — complete the cross-field branch of `select-rules-under-path.ts`; values for a
      covered cross-field rule are read relative to the node for each declared path.

## 7. Cancellation and concurrency

- [ ] 7.1 Red — extend the suite with `Node cancellation and concurrency` scenarios:
      "Pre-aborted signal", "Abort in flight with a late provider response" (hand-written
      deferred provider; register an `unhandledRejection` listener for the test's duration),
      "Abort reason is preserved", "Overlapping calls, one aborted", "Overlapping calls resolve
      with their own values" (same deferred provider answering by `state.fullName`), "Timeout
      under open", "Timeout under closed", "Per-call timeout overrides the instance timeout",
      "Fast provider leaves the caller signal untouched", "No automatic supersession".
- [ ] 7.2 Green — expected to pass through `run-rules`; if the late-response case leaks, fix the
      post-await `signal.aborted` check inside `run-rules` (it must guard both the provider
      response and the assembled result).

## 8. Docs and roadmap

- [ ] 8.1 Red — none.
- [ ] 8.2 Green — README section "Validate one field": on-blur example with `AbortController`
      per field, note that cross-field rules run on submit, `ruleIds` for introspection.
      Constitution §13.5 marked closed by this change. Mark `node-validation` archived in
      `openspec/roadmap.md` on archive.
