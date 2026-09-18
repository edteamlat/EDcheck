## Context

Bootstrap compiles every rule to a Noul question and maps `noul ∈ [0,1]` to `pass | warning | fail`
with thresholds. Constitution §5.1 reserves `kind: "score"` with `levels`; §5.4: "resulting level →
outcome per the mapping declared on the rule; low `confidence` → warning". TypeSafe Score
(verified 2026-09-17): request `{ type: "score", instructions, criteria: string[] }` with at least
two levels; answer `{ type: "score", score, legend: { "<i>": description }, probabilities: { "<i>": p }, confidence }`
where `score` is the probability-weighted level index (may land between levels) and `confidence`
∈ [0,1] is derived from the distribution (example: `{0.05, 0.3, 0.65}` → `0.78`).

## Goals / Non-Goals

**Goals:**

- Score rules that read as a scale: ordered levels, each with its own outcome.
- Deterministic outcome selection that respects the distribution and the model's confidence.
- One request per object with mixed Noul and Score questions.
- Additive types: existing Noul code compiles and behaves identically.

**Non-Goals:**

- Choice primitive. Per-level messages or severities. Calibrating `minConfidence` (change 8).
- Using the weighted `score` value to pick the level.
- Level-specific thresholds or probability bands.

## Decisions

### D1. Level model: inline `{ label, description?, outcome }`

```ts
semantic({
  kind: "score",
  intent: "How well does the description explain the software project?",
  levels: [
    { label: "meaningless", description: "Random, spam-like or unrelated text", outcome: "fail" },
    { label: "vague", description: "On topic but too vague to act on", outcome: "warning" },
    {
      label: "clear",
      description: "Explains what to build or which problem to solve",
      outcome: "pass",
    },
  ],
  minConfidence: 0.7,
  severity: "warning",
});
```

- `levels` is an ordered readonly tuple of at least two entries (type-level `[L, L, ...L[]]`,
  runtime `invalid_rule`). `description` defaults to `label` and is what Jev receives as
  `criteria`. `label` is what issues and fixtures report.
- Every level declares its outcome, so "a level name that is not in the mapping" (roadmap DoD)
  cannot occur by construction; a JS caller omitting `outcome` or passing an unknown value gets
  `invalid_rule` / `invalid_option`.
- Rejected: `levels: string[]` + separate `outcomes` map keyed by label or index. Two parallel
  structures that can disagree; the roadmap's adverse case exists only because of that split.
- Rejected: positional `outcomes: Outcome[]`. Compact but error-prone when levels are reordered.

### D2. Rule discriminator and option exclusivity

- `kind` defaults to `"noul"`. `SemanticRuleOptions = NoulRuleOptions | ScoreRuleOptions`
  discriminated on `kind`; `SemanticRule = NoulRule | ScoreRule`. `semantic()` has three
  overloads: `(statement: string): NoulRule`, `(options: NoulRuleOptions): NoulRule`,
  `(options: ScoreRuleOptions): ScoreRule`.
- Score rejects `thresholds`, `valid`, `invalid` (`invalid_option`); Noul rejects `levels`,
  `minConfidence` (`invalid_option`); unknown `kind` → `invalid_option`. Type-level: excess
  property errors on the union members.
- Rejected: one wide options type with everything optional. Silent misuse (`thresholds` on a
  score rule doing nothing).

### D3. Outcome selection: argmax level, then confidence gate

```
level      = index of max(probabilities); ties → lowest index
outcome    = levels[level].outcome
if confidence < minConfidence: outcome = "warning"
pass → no issue; warning/fail → issue with severity per bootstrap D8
```

- Argmax is faithful to the distribution; the weighted `score` can land on a middle level nobody
  voted for in a bimodal case (`{0.5, 0, 0.5}` → `1.0`). Rejected: `Math.round(score)`.
- Tie → lowest index: deterministic; the author's order goes from the least to the most desirable
  level in practice, so the tie resolves conservatively.
- Confidence gate applies in both directions (a low-confidence `pass` becomes a `warning` issue;
  a low-confidence `fail` is softened to `warning`). Rationale: principle 5, "probability, not
  truth" — the model says it is unsure; the app decides via `severity` whether uncertainty blocks.
  Rejected: gate only `pass` (asymmetric; a low-confidence fail would block on noise).
- `confidence === minConfidence` is not low (`≥` keeps, mirrors `p ≥ pass`).

### D4. `minConfidence` precedence and default

`{ rule ?? schema ?? instance ?? DEFAULT_MIN_CONFIDENCE }`, validated in `[0, 1]`
(`invalid_confidence`). `DEFAULT_MIN_CONFIDENCE = 0.6`, exported, provisional: with TypeSafe's
example distributions, `{0.05, 0.3, 0.65}` → `0.78` passes the gate while flatter distributions do
not. `evaluation-harness` calibrates it. Rejected: folding `minConfidence` into `Thresholds`
(bootstrap issues deep-equal `{ pass, fail }`; Noul rules would carry an irrelevant key).

### D5. Score question template

```
Rate `<path>` on this scale: <intent>
```

`criteria` = level descriptions in declared order. Rejected: the Noul template ("Does `x` fit…")
— grammatically wrong for a scale. Rejected: intent verbatim — no anchoring to the state key. If
`cross-field-rules` is applied, a Score binding compiles to
`Rate <path list> on this scale: <intent>` with the same path-list formatting.

### D6. Provider contract becomes a union

```ts
type NoulQuestion = {
  type: "noul";
  instructions: string;
  criteria?: { true?: string; false?: string };
};
type ScoreQuestion = { type: "score"; instructions: string; criteria: readonly string[] };
type SemanticQuestion = NoulQuestion | ScoreQuestion;
type NoulAnswer = { type: "noul"; noul: number };
type ScoreAnswer = {
  type: "score";
  score: number;
  probabilities: readonly number[];
  confidence: number;
};
type SemanticAnswer = NoulAnswer | ScoreAnswer;
```

- `probabilities` is an array indexed by level (adapter converts TypeSafe's `{ "0": p }` map);
  `legend` is dropped (the rule owns the descriptions).
- **Mock:** `MockAnswer = number | { probabilities: readonly number[]; confidence?: number }`.
  A Score question answered with a number is `malformed` usage → the mock throws a plain `Error`
  (test bug, not provider failure). Default Score answer when unspecified: all mass on the last
  level, `confidence: 1`. The mock computes `score = Σ i·pᵢ` and uses `probabilities` as given
  (no normalization). `confidence` defaults to `1`.
- **TypeSafe adapter:** response schema accepts both answer shapes; a Score answer MUST have
  `probabilities` keys `"0"…"n-1"` for exactly the question's `criteria.length`, values in
  `[0, 1]`, `confidence` in `[0, 1]`, `score` finite; otherwise `malformed_response`.
- **Orchestrator:** an answer whose `type` differs from its question's `type` → the whole
  request is `malformed_response` → `semantic_unavailable` (bootstrap rule for missing answers).

### D7. Score issue shape

```ts
{ path, code: "semantic", severity, outcome, message, ruleId,
  score, confidence, level /* label */, minConfidence, provider: { model } }
```

No `probability`, no `thresholds`. `level` and `minConfidence` are added to `Issue` as optional
fields (`score` and `confidence` already exist in §5.5). Default messages are the bootstrap
templates. Rejected: a `lowConfidence: boolean` flag — derivable from `confidence < minConfidence`.

### D8. Modules touched

| Module       | Files                                                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rules/`     | `types/{noul-rule,score-rule,noul-rule-options,score-rule-options,score-level,rule-kind}`; `semantic` overloads; `normalize-rule` dispatches; `validate-levels` |
| `policy/`    | `default-min-confidence`, `validate-min-confidence`, `resolve-min-confidence`, `map-score-to-outcome`, `types/score-outcome`                                    |
| `compiler/`  | `score-question-template` (constant), `build-score-question`; `build-question` dispatches on `kind`                                                             |
| `providers/` | `types/{noul-question,score-question,noul-answer,score-answer}`; `mock/{answer-score-question,types/mock-answer}`; `typesafe/{response-schema,map-response}`    |
| `result/`    | `score-issue`; `types/issue` gains `level`, `minConfidence`                                                                                                     |
| `api/`       | `minConfidence` on `EDcheckOptions` / `SemanticSchemaOptions`; `run-safe-parse` validates answer types and dispatches outcome mapping                           |
| `index.ts`   | `DEFAULT_MIN_CONFIDENCE` and the new types                                                                                                                      |

### D9. Test strategy

- **Through the public entry:** rule validation (`test/api/semantic-rule.test.ts` extended);
  Score template, mixed request and snapshots (`test/api/score-parse.test.ts`); outcome mapping,
  confidence gate, precedence and issue shape (`test/api/score-outcome.test.ts`); malformed answer
  handling with a hand-written provider (`test/api/score-malformed.test.ts`).
- **Direct unit tests** (`test/policy/`): `map-score-to-outcome` (argmax, ties, gate at/below/
  above, each outcome) and `resolve-min-confidence` (four-level precedence, range validation).
  Pure functions with boundary values.
- **Provider tests** (`test/providers/`): mock Score answers (object form, default, score
  computation, number on score question throws); TypeSafe adapter mapping and malformed cases
  with injected `fetch`.
- **Type tests** (`test/types/score-rule.test-d.ts`): overload return types; exclusivity errors;
  fewer than two levels; `Issue.level`/`minConfidence` optional; `SemanticAnswer` narrowing.
- **Snapshots:** `project-description` score rule (field) and, if `cross-field-rules` is applied,
  a cross-field Score binding.
- **Fixtures** `test/fixtures/project-description/{es,en}.json`: cases with `expectedLevel`
  (`meaningless | vague | clear`), including a 60-repeated-character description (PDR §3) and an
  adversarial string.
- **Eval** `test/eval/project-description.eval.test.ts`: skipped without a key; asserts the argmax
  level equals `expectedLevel` for `positive`/`negative` cases with tolerance: at most one miss per
  language; `ambiguous` listed only.
- **Mock only** everywhere else.

## Risks / Trade-offs

- [Confidence semantics are TypeSafe-specific] → the contract exposes a normalized `confidence ∈
[0,1]`; the gateway adapter (change 6) maps `providerMetadata.typesafe.confidence` to it.
- [Provisional `0.6` mislabels] → exported constant, documented as provisional, calibrated in
  change 8.
- [Softening a low-confidence `fail` to `warning` may let bad data through] → apps with high
  stakes set `minConfidence: 0` (gate off) or collapse levels; documented.
- [Union types ripple through `SemanticRule` consumers] → narrowing on `kind`; type tests guard
  the public shapes.
- [Mixed-kind request changes bootstrap snapshots?] → no; existing snapshots contain only Noul
  questions and are byte-identical.

## Migration Plan

Additive. Noul rules and results are unchanged. The public-surface test list gains one symbol.

## Open Questions

None.
