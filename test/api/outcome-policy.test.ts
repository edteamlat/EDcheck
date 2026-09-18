import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createEDcheck, DEFAULT_THRESHOLDS, mockProvider, semantic } from "edcheck";

const schema = z.object({ fullName: z.string() });
const nameRule = semantic("A plausible full name for a real person");

async function parseWithAnswer(noul: number, options?: Parameters<typeof createEDcheck>[0]) {
  const provider = mockProvider({ answers: { fullName: noul } });
  const bound = createEDcheck({
    provider,
    thresholds: { pass: 0.8, fail: 0.5 },
    ...options,
  }).define(schema, {
    rules: { fullName: nameRule },
  });
  return bound.safeParse({ fullName: "Ana" });
}

describe("probability to outcome mapping", () => {
  it("emits no issue on a clear pass", async () => {
    const result = await parseWithAnswer(0.95);
    expect(result.issues).toEqual([]);
  });

  it("emits no issue exactly at the pass threshold", async () => {
    const result = await parseWithAnswer(0.8);
    expect(result.issues).toEqual([]);
  });

  it("warns just below the pass threshold", async () => {
    const result = await parseWithAnswer(0.79);
    expect(result.issues[0]).toMatchObject({ outcome: "warning", probability: 0.79 });
  });

  it("warns exactly at the fail threshold", async () => {
    const result = await parseWithAnswer(0.5);
    expect(result.issues[0]?.outcome).toBe("warning");
  });

  it("fails just below the fail threshold", async () => {
    const result = await parseWithAnswer(0.49);
    expect(result.issues[0]?.outcome).toBe("fail");
  });

  it("maps extremes", async () => {
    const zero = await parseWithAnswer(0);
    const one = await parseWithAnswer(1);
    expect(zero.issues[0]?.outcome).toBe("fail");
    expect(one.issues).toEqual([]);
  });

  it("Default band boundaries", async () => {
    const answers = [
      DEFAULT_THRESHOLDS.pass,
      DEFAULT_THRESHOLDS.pass - 0.01,
      DEFAULT_THRESHOLDS.fail,
      DEFAULT_THRESHOLDS.fail - 0.01,
    ];
    const outcomes = [];
    for (const noul of answers) {
      const provider = mockProvider({ answers: { fullName: noul } });
      const result = await createEDcheck({ provider })
        .define(schema, { rules: { fullName: nameRule } })
        .safeParse({ fullName: "Ana" });
      outcomes.push(result.issues[0]?.outcome ?? "pass");
    }
    const collapsed = DEFAULT_THRESHOLDS.pass === DEFAULT_THRESHOLDS.fail;
    expect(outcomes).toEqual(
      collapsed ? ["pass", "fail", "pass", "fail"] : ["pass", "warning", "warning", "fail"],
    );
  });

  it("collapses the warning band when pass equals fail", async () => {
    const providerPass = mockProvider({ answers: { fullName: 0.7 } });
    const providerFail = mockProvider({ answers: { fullName: 0.69 } });
    const rule = semantic({ intent: "A name", thresholds: { pass: 0.7, fail: 0.7 } });
    const pass = await createEDcheck({ provider: providerPass })
      .define(schema, { rules: { fullName: rule } })
      .safeParse({ fullName: "Ana" });
    const fail = await createEDcheck({ provider: providerFail })
      .define(schema, { rules: { fullName: rule } })
      .safeParse({ fullName: "Ana" });
    expect(pass.issues).toEqual([]);
    expect(fail.issues[0]?.outcome).toBe("fail");
  });
});

describe("threshold precedence", () => {
  it("lets rule override schema override instance", async () => {
    const provider = mockProvider({ answers: { fullName: 0.1 } });
    const bound = createEDcheck({
      provider,
      thresholds: { pass: 0.6, fail: 0.2 },
    }).define(schema, {
      rules: { fullName: semantic({ intent: "A name", thresholds: { fail: 0.3 } }) },
      thresholds: { pass: 0.7 },
    });
    const result = await bound.safeParse({ fullName: "x" });
    expect(result.issues[0]?.thresholds).toEqual({ pass: 0.7, fail: 0.3 });
  });

  it("keeps sibling thresholds independent", async () => {
    const provider = mockProvider({ answers: { a: 0.9, b: 0.9 } });
    const bound = createEDcheck({ provider }).define(z.object({ a: z.string(), b: z.string() }), {
      rules: {
        a: semantic({ intent: "A", thresholds: { pass: 0.95 } }),
        b: semantic("B"),
      },
    });
    const result = await bound.safeParse({ a: "one", b: "two" });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.ruleId).toBe("a");
    expect(result.issues[0]?.outcome).toBe("warning");
  });

  it("applies an instance-only override", async () => {
    const result = await parseWithAnswer(0.9, { provider: mockProvider({ answers: { fullName: 0.9 } }), thresholds: { pass: 0.95 } });
    expect(result.issues[0]).toMatchObject({
      outcome: "warning",
      thresholds: { pass: 0.95, fail: DEFAULT_THRESHOLDS.fail },
    });
  });
});

describe("severity resolution", () => {
  it("blocks a fail with default severity", async () => {
    const result = await parseWithAnswer(0.1);
    expect(result.issues[0]?.severity).toBe("error");
    expect(result.success).toBe(false);
  });

  it("does not block a fail with warning severity", async () => {
    const provider = mockProvider({ answers: { fullName: 0.1 } });
    const result = await createEDcheck({ provider })
      .define(schema, {
        rules: { fullName: semantic({ intent: "A name", severity: "warning" }) },
      })
      .safeParse({ fullName: "x" });
    expect(result.issues[0]).toMatchObject({ severity: "warning", outcome: "fail" });
    expect(result.success).toBe(true);
  });

  it("downgrades a warning outcome on an error rule", async () => {
    const result = await parseWithAnswer(0.6);
    expect(result.issues[0]?.severity).toBe("warning");
    expect(result.success).toBe(true);
  });

  it("keeps info on a warning outcome", async () => {
    const provider = mockProvider({ answers: { fullName: 0.6 } });
    const result = await createEDcheck({ provider })
      .define(schema, {
        rules: { fullName: semantic({ intent: "A name", severity: "info" }) },
      })
      .safeParse({ fullName: "Ana" });
    expect(result.issues[0]?.severity).toBe("info");
  });

  it("keeps info on a fail outcome", async () => {
    const provider = mockProvider({ answers: { fullName: 0.1 } });
    const result = await createEDcheck({ provider })
      .define(schema, {
        rules: { fullName: semantic({ intent: "A name", severity: "info" }) },
      })
      .safeParse({ fullName: "x" });
    expect(result.issues[0]?.severity).toBe("info");
    expect(result.success).toBe(true);
  });
});
