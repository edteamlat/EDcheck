import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createEDcheck,
  EDcheckProviderError,
  mockProvider,
  semantic,
  type SemanticProvider,
} from "edcheck";

const schema = z.object({ fullName: z.string(), bio: z.string() });
const rules = {
  fullName: semantic("A plausible full name for a real person"),
  bio: semantic("Meaningful professional biography"),
};
const data = { fullName: "Ana Pérez", bio: "Engineer" };

describe("failure policy", () => {
  it("keeps success under the open policy", async () => {
    const provider = mockProvider({
      error: new EDcheckProviderError("http", { status: 503 }),
    });
    const result = await createEDcheck({ provider }).define(schema, { rules }).safeParse(data);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(data);
    expect(result.issues).toHaveLength(2);
    expect(result.issues.every((issue) => issue.code === "semantic_unavailable")).toBe(true);
    expect(result.issues.every((issue) => issue.severity === "warning")).toBe(true);
    expect(result.issues.every((issue) => issue.probability === undefined)).toBe(true);
  });

  it("fails under the closed policy while keeping data", async () => {
    const provider = mockProvider({
      error: new EDcheckProviderError("http", { status: 503 }),
    });
    const result = await createEDcheck({ provider, policy: "closed" })
      .define(schema, { rules })
      .safeParse(data);
    expect(result.issues.every((issue) => issue.severity === "error")).toBe(true);
    expect(result.success).toBe(false);
    expect(result.data).toEqual(data);
  });

  it("lets a schema-level policy override the instance", async () => {
    const provider = mockProvider({
      error: new EDcheckProviderError("http", { status: 503 }),
    });
    const result = await createEDcheck({ provider, policy: "closed" })
      .define(schema, { rules, policy: "open" })
      .safeParse(data);
    expect(result.issues.every((issue) => issue.severity === "warning")).toBe(true);
    expect(result.success).toBe(true);
  });

  it("keeps Zod issues ahead of unavailable issues", async () => {
    const provider = mockProvider({
      error: new EDcheckProviderError("http", { status: 503 }),
    });
    const withAge = z.object({
      fullName: z.string(),
      bio: z.string(),
      age: z.number(),
    });
    const result = await createEDcheck({ provider })
      .define(withAge, { rules })
      .safeParse({ ...data, age: "no" });
    expect(result.issues[0]?.path).toEqual(["age"]);
    expect(result.issues.slice(1).every((issue) => issue.code === "semantic_unavailable")).toBe(
      true,
    );
    expect(result.success).toBe(false);
  });

  it("marks the whole request unavailable when an answer is missing", async () => {
    const provider: SemanticProvider = {
      name: "partial",
      evaluate: async () => ({
        model: "x",
        answers: { fullName: { type: "noul", noul: 0.9 } },
      }),
    };
    const result = await createEDcheck({ provider }).define(schema, { rules }).safeParse(data);
    expect(result.issues).toHaveLength(2);
    expect(result.issues.every((issue) => issue.code === "semantic_unavailable")).toBe(true);
    expect(result.issues.every((issue) => issue.probability === undefined)).toBe(true);
  });

  it("does not leak the API key in unavailable messages", async () => {
    const key = "sk-secret-key-value";
    const provider = mockProvider({
      error: new EDcheckProviderError("http", {
        status: 401,
        message: `Unauthorized with ${key}`,
      }),
    });
    const result = await createEDcheck({ provider }).define(schema, { rules }).safeParse(data);
    expect(result.issues.every((issue) => !issue.message.includes(key))).toBe(true);
    expect(result.issues[0]?.message).toBe(
      'Semantic validation unavailable for rule "fullName"',
    );
  });

  it("does not swallow non-provider errors", async () => {
    const provider: SemanticProvider = {
      name: "bug",
      evaluate: async () => {
        throw new Error("bug");
      },
    };
    await expect(
      createEDcheck({ provider }).define(schema, { rules }).safeParse(data),
    ).rejects.toThrow("bug");
  });

  it("treats noul outside [0, 1] as a malformed request", async () => {
    const provider: SemanticProvider = {
      name: "bad-noul",
      evaluate: async (request) => ({
        model: "x",
        answers: Object.fromEntries(
          Object.keys(request.questions).map((id) => [id, { type: "noul" as const, noul: 1.5 }]),
        ),
      }),
    };
    const result = await createEDcheck({ provider }).define(schema, { rules }).safeParse(data);
    expect(result.issues.every((issue) => issue.code === "semantic_unavailable")).toBe(true);
  });
});
