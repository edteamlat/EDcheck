Every task ends with `yarn verify` green. Red tasks write failing tests for the listed spec
scenarios and stop; green tasks make them pass with the minimum code that respects `design.md`.
Requires `bootstrap-mvp` applied. Independent of `context-inheritance` and `cross-field-rules`;
group 8 runs only when `cross-field-rules` is applied. Scenario names refer to
`specs/<capability>/spec.md`.

## 1. Rule model

- [ ] 1.1 Red — extend `test/api/semantic-rule.test.ts` with `semantic-rules` `Rule kind
discriminator` scenarios (default noul, unknown kind, score options on noul, noul options
      on score) and `Score rule options` scenarios (valid score rule incl. frozen levels, fewer
      than two levels, duplicate labels, empty label or description, missing/unknown outcome,
      minConfidence out of range, boundaries accepted, levels copied). "Same score rule bound to
      two schemas" waits for group 4.
- [ ] 1.2 Green — `src/rules/types/{rule-kind,score-level,noul-rule,score-rule,noul-rule-options,score-rule-options}.ts`;
      `semantic-rule.ts` and `semantic-rule-options.ts` become unions; `semantic()` overloads;
      `normalize-rule` dispatches on `kind`; `rules/validate-levels.ts`;
      `policy/validate-min-confidence.ts` (`invalid_confidence`). Export the new types.

## 2. Policy (pure logic)

- [ ] 2.1 Red — direct unit tests `test/policy/map-score-to-outcome.test.ts`: argmax picks
      level; tie → lowest index; bimodal `[0.5, 0, 0.5]` → index 0; mapped outcome per level;
      gate: confidence below → `warning` for fail and for pass; exactly at → unchanged; just
      below → warning; `minConfidence: 0` disables. Returns `{ levelIndex, outcome }`.
      `test/policy/resolve-min-confidence.test.ts`: rule > schema > instance > default; each
      level optional; `DEFAULT_MIN_CONFIDENCE === 0.6`; out-of-range → `invalid_confidence`.
- [ ] 2.2 Green — `src/policy/{default-min-confidence,resolve-min-confidence,map-score-to-outcome}.ts`,
      `src/policy/types/score-outcome.ts`. Export `DEFAULT_MIN_CONFIDENCE`.

## 3. Provider contract and mock

- [ ] 3.1 Red — `test/providers/mock-provider.test.ts` extended with `provider` `Mock provider
score answers` scenarios (object answer with score within 1e-9, default confidence, default
      score answer, function answers receive the question, number for a score question throws,
      mixed request answers by id). `test/types/semantic-provider.test-d.ts`: `SemanticAnswer`
      narrows on `type`; a provider switching on `question.type` type-checks.
- [ ] 3.2 Green — `src/providers/types/{noul-question,score-question,noul-answer,score-answer}.ts`;
      `semantic-question.ts` / `semantic-answer.ts` become unions; `mock/answer-score-question.ts`,
      `mock/types/mock-answer.ts`; `mock-provider` dispatches on question type. Export the types.
- [ ] 3.3 Confirm `test/providers/import-boundaries.test.ts` still passes ("Provider module
      still has no forbidden imports").

## 4. Compilation, result and the happy path

- [ ] 4.1 Red — `test/fixtures/project-description/{es,en}.json`: rule definition (intent +
      three levels `meaningless | vague | clear`) and cases with `text` and `expectedLevel`
      (≥ 3 per level per language; include the 60-repeated-character description and an
      adversarial string as `meaningless`). `test/api/score-parse.test.ts`: `compilation` `Score
question template` scenarios (shape, description defaults to label, nested path, criteria is
      an array, adversarial value, snapshot) and `Mixed kinds share one request` scenarios (noul
      and score in one request, declaration order, existing snapshots unchanged); `result` `Score
issue shape` scenarios (fully populated fail issue, no noul fields, no score fields on noul,
      warning message, unavailable issue, exported types as a type test);
      `semantic-rules` "Same score rule bound to two schemas".
- [ ] 4.2 Green — `src/compiler/{score-question-template,build-score-question}.ts`;
      `build-question` dispatches on `kind`; `src/result/score-issue.ts`; `Issue.level` and
      `Issue.minConfidence`; `api/run-safe-parse.ts` maps Score answers through
      `map-score-to-outcome` with the resolved `minConfidence`. Commit the new snapshot; confirm
      bootstrap snapshots are untouched.

## 5. Outcome policy through the public entry

- [ ] 5.1 Red — `test/api/score-outcome.test.ts`: `outcome-policy` `Default minimum confidence`
      scenarios (exported constant, default applies, rule > schema > instance, invalid instance or
      schema value, minConfidence does not affect noul rules) and `Score outcome mapping`
      scenarios (highest probability, middle level warning, first level fail, tie, bimodal, low
      confidence softens a fail, low confidence turns pass into warning, exactly at threshold,
      just below, gate disabled, severity rules, custom message).
- [ ] 5.2 Green — `minConfidence` on `EDcheckOptions` and `SemanticSchemaOptions`, validated in
      `create-edcheck` / `define-semantic-schema`; resolved per rule at `define`; fix mapping gaps.

## 6. Answer validation

- [ ] 6.1 Red — `test/api/score-malformed.test.ts` with hand-written providers: `Score answer
validation` scenarios (type mismatch, wrong probabilities length, out-of-range probabilities
      and confidence, valid answer for a mixed request).
- [ ] 6.2 Green — answer-vs-question type check and Score answer range/length validation in
      `api/run-safe-parse.ts`, routed through the existing `malformed_response` failure path.

## 7. TypeSafe adapter

- [ ] 7.1 Red — extend `test/providers/typesafe-provider.test.ts` with `TypeSafe adapter score
mapping` scenarios (request body carries score criteria, response mapping with legend
      dropped, non-contiguous probabilities keys, missing confidence, non-finite score, type
      mismatch).
- [ ] 7.2 Green — `providers/typesafe/response-schema.ts` accepts the Score answer shape;
      `map-response.ts` converts the probabilities map to an array and checks the length against
      the question's `criteria`.

## 8. Cross-field score bindings (only if `cross-field-rules` is applied)

- [ ] 8.1 Red — `test/api/cross-field-score.test.ts`: `compilation` "Cross-field score binding
      template"; a Score binding on two paths fans out one issue per declared path with `level`
      and `paths`; snapshot.
- [ ] 8.2 Green — `build-cross-field-question` dispatches on `kind` with
      `Rate <path list> on this scale: <intent>`. If `cross-field-rules` is not applied, mark 8.1
      and 8.2 as deferred in this file and add a note to the `cross-field-rules` tasks.

## 9. Type tests

- [ ] 9.1 Red — `test/types/score-rule.test-d.ts`: `semantic("x")` and `semantic({ intent })` are
      `NoulRule`; `semantic({ kind: "score", … })` is `ScoreRule`; `thresholds`/`valid`/`invalid`
      on score and `levels`/`minConfidence` on noul are errors; one level is an error;
      `levels[i].outcome` is the `Outcome` union; `Issue.level`, `Issue.minConfidence` optional.
- [ ] 9.2 Green — adjust the unions and overloads until `yarn typecheck` and `vitest --typecheck`
      pass.

## 10. Eval, surface, docs, roadmap

- [ ] 10.1 `test/eval/project-description.eval.test.ts`: `describe.skipIf(!process.env.TYPESAFE_API_KEY)`;
      for each language, the argmax level equals `expectedLevel` with at most one miss per
      language; `ambiguous` cases listed only. Run once locally with a key.
- [ ] 10.2 Red then green — `test/api/public-surface.test.ts`: add `DEFAULT_MIN_CONFIDENCE` to
      the expected list; export it from `src/index.ts`.
- [ ] 10.3 README: "Score rules" section — when to use Score vs Noul, levels example, argmax +
      confidence gate in three sentences, `minConfidence` precedence, `DEFAULT_MIN_CONFIDENCE`
      marked provisional, issue fields.
- [ ] 10.4 `openspec/roadmap.md`: change 5 status. `openspec validate --all` and `yarn verify`.
