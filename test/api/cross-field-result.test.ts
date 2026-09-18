import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createEDcheck,
  EDcheckProviderError,
  mockProvider,
  semantic,
} from "edcheck";

const pair = z.object({ age: z.number(), occupation: z.string() });

describe("semantic issue shape", () => {
  it("Field-rule issue has no paths key", async () => {
    const provider = mockProvider({ answers: { fullName: 0.12 } });
    const result = await createEDcheck({ provider })
      .define(z.object({ fullName: z.string() }), {
        rules: { fullName: semantic("A name") },
      })
      .safeParse({ fullName: "x" });
    expect("paths" in (result.issues[0] ?? {})).toBe(false);
  });

  it("Cross-field issue carries paths", async () => {
    const provider = mockProvider({ answers: { "age+occupation": 0.12 } });
    const result = await createEDcheck({ provider })
      .define(pair, {
        rules: {},
        crossField: [{ paths: ["age", "occupation"], rule: semantic("Coherent") }],
      })
      .safeParse({ age: 7, occupation: "Senior" });
    expect(result.issues.every((issue) => issue.paths)).toBeTruthy();
    expect(result.issues[0]?.paths).toEqual([["age"], ["occupation"]]);
  });
});

describe("cross-field issue attribution", () => {
  it("One issue per declared path", async () => {
    const provider = mockProvider({ answers: { occupation_age_coherence: 0.03 } });
    const result = await createEDcheck({ provider })
      .define(pair, {
        rules: {},
        crossField: [
          {
            paths: ["age", "occupation"],
            rule: semantic({
              intent: "The `occupation` is plausible given `age`",
              id: "occupation_age_coherence",
            }),
          },
        ],
      })
      .safeParse({ age: 7, occupation: "Senior" });
    expect(result.issues).toHaveLength(2);
    expect(result.issues.map((issue) => issue.path)).toEqual([["age"], ["occupation"]]);
    expect(result.issues.every((issue) => issue.ruleId === "occupation_age_coherence")).toBe(
      true,
    );
    expect(result.issues.every((issue) => issue.probability === 0.03)).toBe(true);
    expect(result.issues.every((issue) => issue.outcome === "fail")).toBe(true);
    expect(result.issues.every((issue) => issue.severity === "error")).toBe(true);
  });

  it("Issues are identical except path", async () => {
    const provider = mockProvider({ answers: { occupation_age_coherence: 0.03 } });
    const result = await createEDcheck({ provider })
      .define(pair, {
        rules: {},
        crossField: [
          {
            paths: ["age", "occupation"],
            rule: semantic({
              intent: "The `occupation` is plausible given `age`",
              id: "occupation_age_coherence",
            }),
          },
        ],
      })
      .safeParse({ age: 7, occupation: "Senior" });
    const [first, second] = result.issues;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect({ ...first, path: undefined }).toEqual({ ...second, path: undefined });
  });

  it("Nested declared paths become arrays", async () => {
    const provider = mockProvider({ answers: { "address.city+address.country": 0.1 } });
    const result = await createEDcheck({ provider })
      .define(
        z.object({ address: z.object({ city: z.string(), country: z.string() }) }),
        {
          rules: {},
          crossField: [
            { paths: ["address.city", "address.country"], rule: semantic("Place") },
          ],
        },
      )
      .safeParse({ address: { city: "X", country: "Y" } });
    expect(result.issues.map((issue) => issue.path)).toEqual([
      ["address", "city"],
      ["address", "country"],
    ]);
  });

  it("Single-path binding emits one issue", async () => {
    const provider = mockProvider({ answers: { address: 0.1 } });
    const result = await createEDcheck({ provider })
      .define(z.object({ address: z.object({ city: z.string() }) }), {
        rules: {},
        crossField: [{ paths: ["address"], rule: semantic("Address") }],
      })
      .safeParse({ address: { city: "X" } });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.path).toEqual(["address"]);
    expect(result.issues[0]?.paths).toEqual([["address"]]);
  });

  it("Warning outcome fans out too", async () => {
    const provider = mockProvider({ answers: { "age+occupation": 0.6 } });
    const result = await createEDcheck({ provider, thresholds: { pass: 0.8, fail: 0.5 } })
      .define(pair, {
        rules: {},
        crossField: [{ paths: ["age", "occupation"], rule: semantic("Coherent") }],
      })
      .safeParse({ age: 22, occupation: "Senior" });
    expect(result.issues).toHaveLength(2);
    expect(result.issues.every((issue) => issue.outcome === "warning")).toBe(true);
    expect(result.issues.every((issue) => issue.severity === "warning")).toBe(true);
    expect(result.success).toBe(true);
  });

  it("Severity applies to every issue", async () => {
    const provider = mockProvider({ answers: { "age+occupation": 0.03 } });
    const result = await createEDcheck({ provider })
      .define(pair, {
        rules: {},
        crossField: [
          {
            paths: ["age", "occupation"],
            rule: semantic({ intent: "Coherent", severity: "warning" }),
          },
        ],
      })
      .safeParse({ age: 7, occupation: "Senior" });
    expect(result.issues.every((issue) => issue.severity === "warning")).toBe(true);
    expect(result.success).toBe(true);
  });

  it("Custom message applies to every issue", async () => {
    const provider = mockProvider({ answers: { "age+occupation": 0.03 } });
    const result = await createEDcheck({ provider })
      .define(pair, {
        rules: {},
        crossField: [
          {
            paths: ["age", "occupation"],
            rule: semantic({ intent: "Coherent", message: "Check age and occupation" }),
          },
        ],
      })
      .safeParse({ age: 7, occupation: "Senior" });
    expect(result.issues.every((issue) => issue.message === "Check age and occupation")).toBe(
      true,
    );
  });

  it("Unavailable fans out per path", async () => {
    const provider = mockProvider({
      error: new EDcheckProviderError("http", { status: 503 }),
    });
    const result = await createEDcheck({ provider })
      .define(
        z.object({ fullName: z.string(), age: z.number(), occupation: z.string() }),
        {
          rules: { fullName: semantic("A name") },
          crossField: [{ paths: ["age", "occupation"], rule: semantic("Coherent") }],
        },
      )
      .safeParse({ fullName: "Ana", age: 30, occupation: "Engineer" });
    expect(result.issues).toHaveLength(3);
    expect(result.issues.every((issue) => issue.code === "semantic_unavailable")).toBe(true);
    expect(result.issues.every((issue) => issue.severity === "warning")).toBe(true);
    expect(result.issues.map((issue) => issue.path)).toEqual([
      ["fullName"],
      ["age"],
      ["occupation"],
    ]);
    expect("paths" in (result.issues[0] ?? {})).toBe(false);
    expect(result.issues[1]?.paths).toEqual([["age"], ["occupation"]]);
    expect(result.issues[2]?.paths).toEqual([["age"], ["occupation"]]);
  });

  it("Ordering with field rules", async () => {
    const provider = mockProvider({
      answers: { bio: 0.1, fullName: 0.1, "age+occupation": 0.1 },
    });
    const result = await createEDcheck({ provider })
      .define(
        z.object({
          bio: z.string(),
          fullName: z.string(),
          age: z.number(),
          occupation: z.string(),
        }),
        {
          rules: { bio: semantic("A bio"), fullName: semantic("A name") },
          crossField: [{ paths: ["age", "occupation"], rule: semantic("Coherent") }],
        },
      )
      .safeParse({ bio: "x", fullName: "y", age: 7, occupation: "Senior" });
    expect(result.issues.map((issue) => issue.path.join("."))).toEqual([
      "bio",
      "fullName",
      "age",
      "occupation",
    ]);
  });

  it("Success is false once regardless of fan-out", async () => {
    const provider = mockProvider({ answers: { "age+occupation": 0.03 } });
    const result = await createEDcheck({ provider })
      .define(pair, {
        rules: {},
        crossField: [{ paths: ["age", "occupation"], rule: semantic("Coherent") }],
      })
      .safeParse({ age: 7, occupation: "Senior" });
    expect(result.success).toBe(false);
    expect(result.data).toEqual({ age: 7, occupation: "Senior" });
  });
});
