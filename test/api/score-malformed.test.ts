import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createEDcheck, semantic, type SemanticProvider } from "edcheck";

import { projectDescriptionRule } from "../helpers/project-description-rule.ts";

const schema = z.object({
  fullName: z.string(),
  description: z.string(),
});

function providerReturning(answers: Record<string, unknown>): SemanticProvider {
  return {
    name: "hand-written",
    evaluate: async () => ({
      model: "custom",
      answers: answers as never,
    }),
  };
}

describe("score answer validation", () => {
  it("treats a type mismatch as unavailable", async () => {
    const result = await createEDcheck({
      provider: providerReturning({ description: { type: "noul", noul: 0.9 } }),
    })
      .define(z.object({ description: z.string() }), {
        rules: { description: projectDescriptionRule() },
      })
      .safeParse({ description: "A library" });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.code).toBe("semantic_unavailable");
    expect(result.issues[0]?.severity).toBe("warning");
  });

  it("treats the wrong probabilities length as unavailable", async () => {
    const result = await createEDcheck({
      provider: providerReturning({
        description: {
          type: "score",
          score: 0.5,
          probabilities: [0.5, 0.5],
          confidence: 0.9,
        },
      }),
    })
      .define(z.object({ description: z.string() }), {
        rules: { description: projectDescriptionRule() },
      })
      .safeParse({ description: "A library" });
    expect(result.issues[0]?.code).toBe("semantic_unavailable");
  });

  it("treats out-of-range probabilities as unavailable", async () => {
    const result = await createEDcheck({
      provider: providerReturning({
        description: {
          type: "score",
          score: 0,
          probabilities: [1.5, -0.5, 0],
          confidence: 0.9,
        },
      }),
    })
      .define(z.object({ description: z.string() }), {
        rules: { description: projectDescriptionRule() },
      })
      .safeParse({ description: "A library" });
    expect(result.issues[0]?.code).toBe("semantic_unavailable");
  });

  it("treats out-of-range confidence as unavailable", async () => {
    const result = await createEDcheck({
      provider: providerReturning({
        description: {
          type: "score",
          score: 2,
          probabilities: [0, 0, 1],
          confidence: 1.2,
        },
      }),
    })
      .define(z.object({ description: z.string() }), {
        rules: { description: projectDescriptionRule() },
      })
      .safeParse({ description: "A library" });
    expect(result.issues[0]?.code).toBe("semantic_unavailable");
  });

  it("maps a valid mixed request without unavailable issues", async () => {
    const result = await createEDcheck({
      provider: providerReturning({
        fullName: { type: "noul", noul: 0.95 },
        description: {
          type: "score",
          score: 0.3,
          probabilities: [0.8, 0.1, 0.1],
          confidence: 0.9,
        },
      }),
    })
      .define(schema, {
        rules: {
          fullName: semantic("A name"),
          description: projectDescriptionRule(),
        },
      })
      .safeParse({ fullName: "Ana Pérez", description: "asdf" });
    expect(result.issues.every((issue) => issue.code !== "semantic_unavailable")).toBe(true);
    expect(result.issues.some((issue) => issue.ruleId === "description")).toBe(true);
    expect(result.issues.some((issue) => issue.ruleId === "fullName")).toBe(false);
  });
});
