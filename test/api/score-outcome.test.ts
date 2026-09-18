import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createEDcheck, DEFAULT_MIN_CONFIDENCE, mockProvider, semantic } from "edcheck";

import { projectDescriptionRule } from "../helpers/project-description-rule.ts";

const schema = z.object({ description: z.string() });

async function parseDescription(
  probabilities: readonly number[],
  options: {
    confidence?: number;
    minConfidence?: number;
    schemaMinConfidence?: number;
    ruleMinConfidence?: number;
    severity?: "error" | "warning" | "info";
    message?: string;
  } = {},
) {
  const provider = mockProvider({
    answers: {
      description: {
        probabilities,
        confidence: options.confidence ?? 0.9,
      },
    },
  });
  return createEDcheck({
    provider,
    ...(options.minConfidence === undefined ? {} : { minConfidence: options.minConfidence }),
  })
    .define(schema, {
      rules: {
        description: projectDescriptionRule({
          ...(options.ruleMinConfidence === undefined
            ? {}
            : { minConfidence: options.ruleMinConfidence }),
          ...(options.severity === undefined ? {} : { severity: options.severity }),
          ...(options.message === undefined ? {} : { message: options.message }),
        }),
      },
      ...(options.schemaMinConfidence === undefined
        ? {}
        : { minConfidence: options.schemaMinConfidence }),
    })
    .safeParse({ description: "A library" });
}

describe("default minimum confidence", () => {
  it("exports the provisional constant", () => {
    expect(DEFAULT_MIN_CONFIDENCE).toBe(0.6);
  });

  it("applies the default when nothing overrides", async () => {
    const result = await parseDescription([0.8, 0.1, 0.1]);
    expect(result.issues[0]?.minConfidence).toBe(0.6);
  });

  it("prefers rule over schema over instance", async () => {
    const withRule = await parseDescription([0.8, 0.1, 0.1], {
      minConfidence: 0.3,
      schemaMinConfidence: 0.5,
      ruleMinConfidence: 0.9,
    });
    expect(withRule.issues[0]?.minConfidence).toBe(0.9);

    const withSchema = await parseDescription([0.8, 0.1, 0.1], {
      minConfidence: 0.3,
      schemaMinConfidence: 0.5,
    });
    expect(withSchema.issues[0]?.minConfidence).toBe(0.5);

    const withInstance = await parseDescription([0.8, 0.1, 0.1], { minConfidence: 0.3 });
    expect(withInstance.issues[0]?.minConfidence).toBe(0.3);
  });

  it("rejects an invalid instance or schema value", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider(), minConfidence: 2 }),
    ).toThrowError(expect.objectContaining({ code: "invalid_confidence" }));
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(schema, {
        rules: { description: projectDescriptionRule() },
        minConfidence: -1,
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_confidence" }));
  });

  it("does not apply minConfidence to noul rules", async () => {
    const provider = mockProvider({ answers: { fullName: 0.95 } });
    const result = await createEDcheck({ provider, minConfidence: 1 })
      .define(z.object({ fullName: z.string() }), {
        rules: { fullName: semantic("A name") },
      })
      .safeParse({ fullName: "Ana Pérez" });
    expect(result.issues).toEqual([]);
  });
});

describe("score outcome mapping", () => {
  it("emits no issue when the highest probability is pass", async () => {
    const result = await parseDescription([0.1, 0.2, 0.7]);
    expect(result.issues).toEqual([]);
  });

  it("emits a warning for the middle level", async () => {
    const result = await parseDescription([0.2, 0.6, 0.2]);
    expect(result.issues[0]).toMatchObject({
      outcome: "warning",
      level: "vague",
      severity: "warning",
    });
  });

  it("emits a fail for the first level", async () => {
    const result = await parseDescription([0.8, 0.1, 0.1]);
    expect(result.issues[0]).toMatchObject({
      outcome: "fail",
      level: "meaningless",
      severity: "error",
    });
    expect(result.success).toBe(false);
  });

  it("resolves a tie to the lowest index", async () => {
    const result = await parseDescription([0.5, 0.5, 0]);
    expect(result.issues[0]?.level).toBe("meaningless");
  });

  it("does not pick the middle on a bimodal distribution", async () => {
    const result = await parseDescription([0.5, 0, 0.5]);
    expect(result.issues[0]).toMatchObject({ level: "meaningless", outcome: "fail" });
  });

  it("softens a fail when confidence is low", async () => {
    const result = await parseDescription([0.4, 0.3, 0.3], { confidence: 0.2 });
    expect(result.issues[0]).toMatchObject({
      outcome: "warning",
      level: "meaningless",
      confidence: 0.2,
      minConfidence: 0.6,
    });
    expect(result.success).toBe(true);
  });

  it("turns a pass into a warning when confidence is low", async () => {
    const result = await parseDescription([0.3, 0.3, 0.4], { confidence: 0.2 });
    expect(result.issues[0]).toMatchObject({ outcome: "warning", level: "clear" });
  });

  it("does not treat confidence exactly at the threshold as low", async () => {
    const result = await parseDescription([0.3, 0.3, 0.4], { confidence: 0.6 });
    expect(result.issues).toEqual([]);
  });

  it("treats confidence just below the threshold as low", async () => {
    const result = await parseDescription([0.3, 0.3, 0.4], { confidence: 0.59 });
    expect(result.issues[0]?.outcome).toBe("warning");
  });

  it("uses the mapped outcome when the gate is disabled", async () => {
    const result = await parseDescription([0.8, 0.1, 0.1], {
      confidence: 0,
      ruleMinConfidence: 0,
    });
    expect(result.issues[0]?.outcome).toBe("fail");
  });

  it("applies severity the same way as noul", async () => {
    const failAsWarning = await parseDescription([0.8, 0.1, 0.1], { severity: "warning" });
    expect(failAsWarning.issues[0]?.severity).toBe("warning");
    expect(failAsWarning.success).toBe(true);

    const warningAsInfo = await parseDescription([0.2, 0.6, 0.2], { severity: "info" });
    expect(warningAsInfo.issues[0]?.severity).toBe("info");
    expect(warningAsInfo.success).toBe(true);
  });

  it("applies a custom message", async () => {
    const result = await parseDescription([0.8, 0.1, 0.1], {
      message: "Describe the project",
    });
    expect(result.issues[0]?.message).toBe("Describe the project");
  });
});
