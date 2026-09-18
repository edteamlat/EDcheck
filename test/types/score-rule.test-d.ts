import { expectTypeOf, test } from "vitest";

import {
  semantic,
  type Issue,
  type NoulRule,
  type NoulRuleOptions,
  type Outcome,
  type ScoreRule,
  type ScoreRuleOptions,
} from "edcheck";

test("string and noul options return NoulRule", () => {
  expectTypeOf(semantic("A name")).toEqualTypeOf<NoulRule>();
  expectTypeOf(semantic({ intent: "A name" })).toEqualTypeOf<NoulRule>();
});

test("score options return ScoreRule", () => {
  expectTypeOf(
    semantic({
      kind: "score",
      intent: "Clarity",
      levels: [
        { label: "bad", outcome: "fail" },
        { label: "good", outcome: "pass" },
      ],
    }),
  ).toEqualTypeOf<ScoreRule>();
});

test("noul options reject score fields", () => {
  const options: NoulRuleOptions = {
    intent: "A name",
    // @ts-expect-error levels belong on score rules
    levels: [
      { label: "bad", outcome: "fail" },
      { label: "good", outcome: "pass" },
    ],
  };
  semantic(options);
});

test("noul options reject minConfidence", () => {
  const options: NoulRuleOptions = {
    intent: "A name",
    // @ts-expect-error minConfidence belongs on score rules
    minConfidence: 0.5,
  };
  semantic(options);
});

test("score options reject thresholds", () => {
  const options: ScoreRuleOptions = {
    kind: "score",
    intent: "Clarity",
    levels: [
      { label: "bad", outcome: "fail" },
      { label: "good", outcome: "pass" },
    ],
    // @ts-expect-error thresholds belong on noul rules
    thresholds: { pass: 0.9 },
  };
  semantic(options);
});

test("score options reject valid", () => {
  const options: ScoreRuleOptions = {
    kind: "score",
    intent: "Clarity",
    levels: [
      { label: "bad", outcome: "fail" },
      { label: "good", outcome: "pass" },
    ],
    // @ts-expect-error valid belongs on noul rules
    valid: "x",
  };
  semantic(options);
});

test("score options reject invalid", () => {
  const options: ScoreRuleOptions = {
    kind: "score",
    intent: "Clarity",
    levels: [
      { label: "bad", outcome: "fail" },
      { label: "good", outcome: "pass" },
    ],
    // @ts-expect-error invalid belongs on noul rules
    invalid: "y",
  };
  semantic(options);
});

test("one level is a type error", () => {
  const options: ScoreRuleOptions = {
    kind: "score",
    intent: "Clarity",
    // @ts-expect-error score rules need at least two levels
    levels: [{ label: "only", outcome: "fail" }],
  };
  semantic(options);
});

test("level outcome is the Outcome union", () => {
  const rule = semantic({
    kind: "score",
    intent: "Clarity",
    levels: [
      { label: "bad", outcome: "fail" },
      { label: "good", outcome: "pass" },
    ],
  });
  const level = rule.levels[0];
  if (level !== undefined) {
    expectTypeOf(level.outcome).toEqualTypeOf<Outcome>();
  }
});

test("Issue level and minConfidence are optional", () => {
  expectTypeOf<Issue["level"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<Issue["minConfidence"]>().toEqualTypeOf<number | undefined>();
});
