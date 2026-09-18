import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createEDcheck, mockProvider, semantic } from "edcheck";

const pair = z.object({ age: z.number(), occupation: z.string() });

const scoreBinding = semantic({
  kind: "score",
  intent: "How well do age and occupation fit together?",
  levels: [
    { label: "incoherent", description: "The occupation cannot match the age", outcome: "fail" },
    { label: "uncertain", description: "The pair is possible but strained", outcome: "warning" },
    { label: "coherent", description: "The occupation is plausible for the age", outcome: "pass" },
  ],
  id: "age_occupation_score",
});

describe("cross-field score binding", () => {
  it("compiles the score template with a path list", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(pair, {
        rules: {},
        crossField: [{ paths: ["age", "occupation"], rule: scoreBinding }],
      })
      .safeParse({ age: 35, occupation: "Software engineer" });
    const question = provider.calls[0]?.questions.age_occupation_score;
    expect(question?.type).toBe("score");
    if (question?.type === "score") {
      expect(question.instructions.startsWith("Rate `age` and `occupation` on this scale:")).toBe(
        true,
      );
      expect(question.criteria).toEqual([
        "The occupation cannot match the age",
        "The pair is possible but strained",
        "The occupation is plausible for the age",
      ]);
    }
  });

  it("fans out one issue per declared path with level and paths", async () => {
    const provider = mockProvider({
      answers: {
        age_occupation_score: { probabilities: [0.8, 0.1, 0.1], confidence: 0.9 },
      },
    });
    const result = await createEDcheck({ provider })
      .define(pair, {
        rules: {},
        crossField: [{ paths: ["age", "occupation"], rule: scoreBinding }],
      })
      .safeParse({ age: 7, occupation: "Senior engineer" });
    expect(result.issues).toHaveLength(2);
    expect(result.issues.map((issue) => issue.path)).toEqual([["age"], ["occupation"]]);
    expect(result.issues.every((issue) => issue.level === "incoherent")).toBe(true);
    expect(result.issues.every((issue) => issue.paths)).toBeTruthy();
    expect(result.issues[0]?.paths).toEqual([["age"], ["occupation"]]);
    expect("probability" in (result.issues[0] ?? {})).toBe(false);
  });

  it("matches the compiled payload snapshot", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(pair, {
        rules: {},
        crossField: [{ paths: ["age", "occupation"], rule: scoreBinding }],
      })
      .safeParse({ age: 35, occupation: "Software engineer" });
    expect(provider.calls[0]).toMatchSnapshot();
  });
});
