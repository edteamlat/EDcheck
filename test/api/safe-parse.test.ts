import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createEDcheck,
  DEFAULT_THRESHOLDS,
  mockProvider,
  semantic,
} from "edcheck";

import esFullName from "../fixtures/full-name/es.json";

const nameRule = semantic("A plausible full name for a real person");
const bioRule = semantic({
  intent: "Meaningful professional biography",
  valid: "Describes the person's professional background coherently",
  invalid: "Meaningless, irrelevant or clearly unrelated text",
});

const sixFieldSchema = z.object({
  fullName: z.string(),
  age: z.number(),
  email: z.string(),
  bio: z.string(),
  role: z.string(),
  city: z.string(),
});

const sixRules = {
  fullName: nameRule,
  age: semantic("A plausible age for a person"),
  email: semantic("A plausible email address"),
  bio: bioRule,
  role: semantic("A plausible role"),
  city: semantic("A plausible city name"),
};

const sixData = {
  fullName: "Ana Pérez",
  age: 30,
  email: "ana@example.com",
  bio: "Software engineer in Madrid",
  role: "engineer",
  city: "Madrid",
};

describe("compilation happy path", () => {
  it("sends six rules as one request with six questions", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(sixFieldSchema, { rules: sixRules });
    const result = await bound.safeParse(sixData);
    expect(provider.calls).toHaveLength(1);
    expect(Object.keys(provider.calls[0]?.questions ?? {})).toHaveLength(6);
    expect(result.data).toEqual(sixData);
  });

  it("restricts state to rule fields", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(
      z.object({ fullName: z.string(), age: z.number(), email: z.string() }),
      { rules: { fullName: nameRule } },
    );
    await bound.safeParse({ fullName: "Ana Pérez", age: 30, email: "a@b.c" });
    expect(provider.calls[0]?.state).toEqual({ fullName: "Ana Pérez" });
  });

  it("mirrors nested state structure", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(
      z.object({
        fullName: z.string(),
        address: z.object({ street: z.string() }),
      }),
      { rules: { fullName: nameRule, "address.street": nameRule } },
    );
    await bound.safeParse({ fullName: "Ana", address: { street: "Gran Vía" } });
    expect(provider.calls[0]?.state).toEqual({
      fullName: "Ana",
      address: { street: "Gran Vía" },
    });
  });

  it("sends non-string primitives as-is", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(
      z.object({ age: z.number(), active: z.boolean() }),
      {
        rules: {
          age: semantic("A plausible age"),
          active: semantic("Whether the account is active"),
        },
      },
    );
    await bound.safeParse({ age: 7, active: true });
    expect(provider.calls[0]?.state).toEqual({ age: 7, active: true });
  });
});

describe("question template", () => {
  it("compiles a basic rule without criteria", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(z.object({ fullName: z.string() }), {
      rules: { fullName: nameRule },
    });
    await bound.safeParse({ fullName: "Ana Pérez" });
    expect(provider.calls[0]?.questions.fullName).toEqual({
      type: "noul",
      instructions:
        "Does `fullName` fit the following description? A plausible full name for a real person",
    });
  });

  it("compiles an advanced rule with both criteria", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(z.object({ bio: z.string() }), {
      rules: { bio: bioRule },
    });
    await bound.safeParse({ bio: "Engineer" });
    expect(provider.calls[0]?.questions.bio?.criteria).toEqual({
      true: "Describes the person's professional background coherently",
      false: "Meaningless, irrelevant or clearly unrelated text",
    });
  });

  it("omits a missing criteria key", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(z.object({ fullName: z.string() }), {
      rules: { fullName: semantic({ intent: "A name", valid: "Looks like a real name" }) },
    });
    await bound.safeParse({ fullName: "Ana" });
    expect(provider.calls[0]?.questions.fullName?.criteria).toEqual({
      true: "Looks like a real name",
    });
  });

  it("uses dotted backticks for nested paths", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(
      z.object({ address: z.object({ street: z.string() }) }),
      { rules: { "address.street": nameRule } },
    );
    await bound.safeParse({ address: { street: "Gran Vía" } });
    expect(provider.calls[0]?.questions["address.street"]?.instructions).toMatch(
      /^Does `address\.street` fit the following description\?/,
    );
  });

  it("matches the compiled payload snapshot for fixture rules", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(
      z.object({ fullName: z.string(), bio: z.string() }),
      { rules: { fullName: nameRule, bio: bioRule } },
    );
    await bound.safeParse({ fullName: esFullName.positive[0], bio: "Ingeniera de software" });
    expect(provider.calls[0]).toMatchSnapshot();
  });
});

describe("rule ids and ordering", () => {
  it("defaults the id to the dotted path", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(
      z.object({
        fullName: z.string(),
        address: z.object({ street: z.string() }),
      }),
      { rules: { fullName: nameRule, "address.street": nameRule } },
    );
    await bound.safeParse({ fullName: "Ana", address: { street: "A" } });
    expect(Object.keys(provider.calls[0]?.questions ?? {})).toEqual([
      "fullName",
      "address.street",
    ]);
  });

  it("uses an explicit id on the question and issue", async () => {
    const provider = mockProvider({ answers: { name_plausible: 0.1 } });
    const bound = createEDcheck({ provider }).define(z.object({ fullName: z.string() }), {
      rules: { fullName: semantic({ intent: "A name", id: "name_plausible" }) },
    });
    const result = await bound.safeParse({ fullName: "xx" });
    expect(Object.keys(provider.calls[0]?.questions ?? {})).toEqual(["name_plausible"]);
    expect(result.issues[0]?.ruleId).toBe("name_plausible");
  });

  it("preserves declaration order", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(
      z.object({ fullName: z.string(), age: z.number(), bio: z.string() }),
      {
        rules: {
          bio: bioRule,
          fullName: nameRule,
          age: semantic("A plausible age"),
        },
      },
    );
    await bound.safeParse({ fullName: "Ana", age: 1, bio: "text" });
    expect(Object.keys(provider.calls[0]?.questions ?? {})).toEqual(["bio", "fullName", "age"]);
  });
});

describe("semantic issue shape", () => {
  it("fully populates a fail issue", async () => {
    const provider = mockProvider({ answers: { fullName: 0.12 }, model: "mock" });
    const bound = createEDcheck({ provider }).define(z.object({ fullName: z.string() }), {
      rules: { fullName: nameRule },
    });
    const result = await bound.safeParse({ fullName: "asdfasdf" });
    expect(result.issues[0]).toEqual({
      path: ["fullName"],
      code: "semantic",
      severity: "error",
      outcome: "fail",
      message: 'Semantic rule "fullName" failed',
      ruleId: "fullName",
      probability: 0.12,
      thresholds: { pass: 0.8, fail: 0.5 },
      provider: { model: "mock" },
    });
  });

  it("uses an array path for nested rules", async () => {
    const provider = mockProvider({ answers: { "address.street": 0.1 } });
    const bound = createEDcheck({ provider }).define(
      z.object({ address: z.object({ street: z.string() }) }),
      { rules: { "address.street": nameRule } },
    );
    const result = await bound.safeParse({ address: { street: "x" } });
    expect(result.issues[0]?.path).toEqual(["address", "street"]);
  });

  it("uses the default warning message", async () => {
    const provider = mockProvider({ answers: { fullName: 0.6 } });
    const bound = createEDcheck({ provider }).define(z.object({ fullName: z.string() }), {
      rules: { fullName: nameRule },
    });
    const result = await bound.safeParse({ fullName: "Ana" });
    expect(result.issues[0]?.message).toBe('Semantic rule "fullName" is uncertain');
  });

  it("uses a custom message for warning and fail", async () => {
    const rule = semantic({
      intent: "A name",
      message: "Please enter your real name",
    });
    const warningProvider = mockProvider({ answers: { fullName: 0.6 } });
    const failProvider = mockProvider({ answers: { fullName: 0.1 } });
    const schema = z.object({ fullName: z.string() });
    const warning = await createEDcheck({ provider: warningProvider })
      .define(schema, { rules: { fullName: rule } })
      .safeParse({ fullName: "Ana" });
    const fail = await createEDcheck({ provider: failProvider })
      .define(schema, { rules: { fullName: rule } })
      .safeParse({ fullName: "xx" });
    expect(warning.issues[0]?.message).toBe("Please enter your real name");
    expect(fail.issues[0]?.message).toBe("Please enter your real name");
  });

  it("emits nothing on pass", async () => {
    const provider = mockProvider({ defaultAnswer: 0.95 });
    const bound = createEDcheck({ provider }).define(z.object({ fullName: z.string() }), {
      rules: { fullName: nameRule },
    });
    const result = await bound.safeParse({ fullName: "Ana Pérez" });
    expect(result.issues).toEqual([]);
    expect(result.success).toBe(true);
  });
});

describe("default thresholds", () => {
  it("exports the frozen provisional constant", () => {
    expect(DEFAULT_THRESHOLDS).toEqual({ pass: 0.8, fail: 0.5 });
    expect(Object.isFrozen(DEFAULT_THRESHOLDS)).toBe(true);
  });

  it("applies defaults when nothing overrides", async () => {
    const provider = mockProvider({ answers: { fullName: 0.1 } });
    const bound = createEDcheck({ provider }).define(z.object({ fullName: z.string() }), {
      rules: { fullName: nameRule },
    });
    const result = await bound.safeParse({ fullName: "x" });
    expect(result.issues[0]?.thresholds).toEqual({ pass: 0.8, fail: 0.5 });
  });
});

describe("shape-first execution", () => {
  it("excludes only the node that failed shape", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(
      z.object({ fullName: z.string(), bio: z.string().min(10) }),
      { rules: { fullName: nameRule, bio: bioRule } },
    );
    const result = await bound.safeParse({ fullName: "Ana Pérez", bio: "abc" });
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]?.questions).not.toHaveProperty("bio");
    expect(provider.calls[0]?.questions).toHaveProperty("fullName");
    expect(provider.calls[0]?.state).not.toHaveProperty("bio");
    expect(result.issues.some((issue) => issue.path[0] === "bio" && issue.code === "too_small")).toBe(
      true,
    );
  });

  it("makes zero calls when every rule node fails shape", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(
      z.object({ fullName: z.string().min(8), bio: z.string().min(10) }),
      { rules: { fullName: nameRule, bio: bioRule } },
    );
    const result = await bound.safeParse({ fullName: "a", bio: "b" });
    expect(provider.calls).toHaveLength(0);
    expect(result.success).toBe(false);
    expect(result.issues.every((issue) => issue.code !== "semantic")).toBe(true);
  });

  it("excludes every rule when a root-level Zod issue exists", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(z.strictObject({ fullName: z.string() }), {
      rules: { fullName: nameRule },
    });
    const result = await bound.safeParse({ fullName: "Ana", extra: true });
    expect(provider.calls).toHaveLength(0);
    expect(result.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });

  it("sends the trimmed Zod output when a sibling failed", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(
      z.object({ fullName: z.string().trim(), bio: z.string().min(10) }),
      { rules: { fullName: nameRule, bio: bioRule } },
    );
    await bound.safeParse({ fullName: "  Ana Pérez  ", bio: "x" });
    expect(provider.calls[0]?.state.fullName).toBe("Ana Pérez");
  });

  it("sends the default value when the field is omitted", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(
      z.object({ role: z.string().default("member") }),
      { rules: { role: semantic("A plausible role") } },
    );
    await bound.safeParse({});
    expect(provider.calls[0]?.state.role).toBe("member");
  });

  it("skips an absent optional rule", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(
      z.object({ fullName: z.string(), bio: z.string().optional() }),
      { rules: { fullName: nameRule, bio: bioRule } },
    );
    const result = await bound.safeParse({ fullName: "Ana Pérez" });
    expect(Object.keys(provider.calls[0]?.questions ?? {})).toEqual(["fullName"]);
    expect(result.issues.some((issue) => issue.ruleId === "bio")).toBe(false);
  });

  it("makes zero calls when the only rule value is null", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(
      z.object({ bio: z.string().nullable() }),
      { rules: { bio: bioRule } },
    );
    const result = await bound.safeParse({ bio: null });
    expect(provider.calls).toHaveLength(0);
    expect(result).toEqual({ success: true, data: { bio: null }, issues: [] });
  });

  it("passes through a Zod array-index issue without dropping sibling rules", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(
      z.object({ fullName: z.string(), tags: z.array(z.string().min(2)) }),
      { rules: { fullName: nameRule } },
    );
    const result = await bound.safeParse({ fullName: "Ana Pérez", tags: ["ok", "x"] });
    expect(provider.calls).toHaveLength(1);
    expect(result.issues.some((issue) => issue.path[0] === "tags" && issue.path[1] === 1)).toBe(
      true,
    );
  });
});

describe("Zod issues pass through", () => {
  it("keeps codes, paths and messages identical", async () => {
    const schema = z.object({
      fullName: z.string().min(3),
      age: z.number(),
      bio: z.string().min(4),
    });
    const data = { fullName: "ab", age: "no", bio: "x" };
    const zodIssues = schema.safeParse(data);
    const bound = createEDcheck({ provider: mockProvider() }).define(schema, { rules: {} });
    const result = await bound.safeParse(data);
    expect(zodIssues.success).toBe(false);
    if (zodIssues.success) {
      return;
    }
    expect(result.issues.slice(0, 3).map(({ code, path, message, severity }) => ({
      code,
      path,
      message,
      severity,
    }))).toEqual(
      zodIssues.error.issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
        message: issue.message,
        severity: "error",
      })),
    );
  });

  it("preserves numeric array index paths", async () => {
    const bound = createEDcheck({ provider: mockProvider() }).define(
      z.object({ tags: z.array(z.string().min(2)) }),
      { rules: {} },
    );
    const result = await bound.safeParse({ tags: ["ok", "x"] });
    const issue = result.issues.find((item) => item.path[0] === "tags");
    expect(issue?.path).toEqual(["tags", 1]);
    expect(typeof issue?.path[1]).toBe("number");
  });

  it("yields no data when shape fails", async () => {
    const bound = createEDcheck({ provider: mockProvider() }).define(
      z.object({ fullName: z.string() }),
      { rules: {} },
    );
    const result = await bound.safeParse({ fullName: 1 });
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
  });

  it("parses a Zod-only schema without rules", async () => {
    const bound = createEDcheck({ provider: mockProvider() }).define(
      z.object({ fullName: z.string() }),
      { rules: {} },
    );
    const invalid = await bound.safeParse({ fullName: 1 });
    const valid = await bound.safeParse({ fullName: "Ana" });
    expect(invalid.success).toBe(false);
    expect(invalid.data).toBeUndefined();
    expect(valid).toEqual({ success: true, data: { fullName: "Ana" }, issues: [] });
  });
});

describe("success semantics", () => {
  it("keeps data when shape passed and a semantic error exists", async () => {
    const provider = mockProvider({ answers: { fullName: 0.1 } });
    const bound = createEDcheck({ provider }).define(z.object({ fullName: z.string() }), {
      rules: { fullName: nameRule },
    });
    const result = await bound.safeParse({ fullName: "asdfasdf" });
    expect(result.success).toBe(false);
    expect(result.data).toEqual({ fullName: "asdfasdf" });
  });

  it("stays successful when issues are only warning and info", async () => {
    const provider = mockProvider({ answers: { fullName: 0.6, bio: 0.1 } });
    const bound = createEDcheck({ provider }).define(
      z.object({ fullName: z.string(), bio: z.string() }),
      {
        rules: {
          fullName: nameRule,
          bio: semantic({ intent: "A bio", severity: "info" }),
        },
      },
    );
    const result = await bound.safeParse({ fullName: "Ana", bio: "x" });
    expect(result.issues.map((issue) => issue.severity)).toEqual(["warning", "info"]);
    expect(result.success).toBe(true);
  });

  it("puts Zod issues before semantic issues", async () => {
    const provider = mockProvider({ answers: { fullName: 0.1 } });
    const bound = createEDcheck({ provider }).define(
      z.object({ fullName: z.string(), bio: z.string().min(10) }),
      { rules: { fullName: nameRule, bio: bioRule } },
    );
    const result = await bound.safeParse({ fullName: "asdfasdf", bio: "x" });
    expect(result.issues[0]?.path).toEqual(["bio"]);
    expect(result.issues[0]?.code).not.toBe("semantic");
    expect(result.issues[1]?.ruleId).toBe("fullName");
  });

  it("lists semantic issues in declaration order", async () => {
    const provider = mockProvider({ defaultAnswer: 0.1 });
    const bound = createEDcheck({ provider }).define(
      z.object({ fullName: z.string(), bio: z.string() }),
      { rules: { bio: bioRule, fullName: nameRule } },
    );
    const result = await bound.safeParse({ fullName: "x", bio: "y" });
    expect(result.issues.map((issue) => issue.ruleId)).toEqual(["bio", "fullName"]);
  });
});
