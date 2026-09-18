import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createEDcheck, EDcheckConfigError, mockProvider, semantic } from "edcheck";

const nameRule = semantic("A plausible full name for a real person");
const schema = z.object({
  fullName: z.string(),
  address: z.object({
    street: z.string(),
  }),
});
const data = {
  fullName: "Ana Pérez",
  address: { street: "Gran Vía" },
};

function callFor(
  provider: ReturnType<typeof mockProvider>,
  ruleId: string,
): NonNullable<ReturnType<typeof mockProvider>["calls"][number]> {
  const found = provider.calls.find((call) => ruleId in call.questions);
  expect(found, `missing call for ${ruleId}`).toBeDefined();
  return found as NonNullable<typeof found>;
}

describe("context forms and normalization", () => {
  it("String context becomes a note", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider, context: "Client intake form" })
      .define(schema, { rules: { fullName: nameRule } })
      .safeParse(data);
    expect(provider.calls[0]?.state.context).toEqual({ notes: ["Client intake form"] });
  });

  it("Object context is carried as-is", async () => {
    const provider = mockProvider();
    const context = { domain: "software", purpose: "project intake", tenant: "acme" };
    await createEDcheck({ provider })
      .define(schema, { rules: { fullName: nameRule }, context })
      .safeParse(data);
    expect(provider.calls[0]?.state.context).toEqual(context);
  });

  it("Notes array at one level is preserved in order", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(schema, {
        rules: { fullName: nameRule },
        context: { notes: ["first", "second"] },
      })
      .safeParse(data);
    expect((provider.calls[0]?.state.context as { notes: string[] }).notes).toEqual([
      "first",
      "second",
    ]);
  });

  it("Empty string context is rejected", () => {
    expect(() => createEDcheck({ provider: mockProvider(), context: "   " })).toThrowError(
      expect.objectContaining({ code: "invalid_context" }),
    );
  });

  it("Reserved key with a non-string value is rejected", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(schema, {
        rules: { fullName: nameRule },
        context: { locale: 42 } as never,
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_context" }));
  });

  it("Invalid notes are rejected", () => {
    expect(() => semantic({ intent: "A name", context: { notes: ["ok", ""] } })).toThrow(
      EDcheckConfigError,
    );
    expect(() => semantic({ intent: "A name", context: { notes: "text" } as never })).toThrowError(
      expect.objectContaining({ code: "invalid_context" }),
    );
  });

  it("Non-object non-string is rejected", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(schema, {
        rules: { fullName: nameRule },
        context: 7 as never,
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_context" }));
  });

  it("Empty object is a no-op", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(schema, { rules: { fullName: nameRule }, context: {} })
      .safeParse(data);
    expect(provider.calls[0]?.state).toEqual({ fullName: "Ana Pérez" });
  });

  it("Undefined values are ignored", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(schema, {
        rules: { fullName: nameRule },
        context: { domain: "x", purpose: undefined } as never,
      })
      .safeParse(data);
    expect(provider.calls[0]?.state.context).toEqual({ domain: "x" });
  });

  it("Caller mutation after attachment does not leak", async () => {
    const provider = mockProvider();
    const ctx = { domain: "a", notes: ["n"] };
    const rule = semantic({ intent: "A name", context: ctx });
    ctx.domain = "b";
    ctx.notes.push("m");
    await createEDcheck({ provider })
      .define(schema, { rules: { fullName: rule } })
      .safeParse(data);
    expect(provider.calls[0]?.state.context).toEqual({ domain: "a", notes: ["n"] });
  });
});

describe("attachment levels", () => {
  it("Instance level reaches every rule", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider, context: { domain: "hr" } })
      .define(schema, {
        rules: {
          fullName: nameRule,
          "address.street": semantic("A street"),
        },
      })
      .safeParse(data);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]?.state.context).toEqual({ domain: "hr" });
  });

  it("Schema level", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(schema, { rules: { fullName: nameRule }, context: { purpose: "signup" } })
      .safeParse(data);
    expect(provider.calls[0]?.state.context).toEqual({ purpose: "signup" });
  });

  it("Node level on an object path reaches nested rules", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(schema, {
        rules: { fullName: nameRule, "address.street": semantic("A street") },
        nodeContext: { address: { locale: "es-BO" } },
      })
      .safeParse(data);
    expect(callFor(provider, "address.street").state.context).toEqual({ locale: "es-BO" });
    expect(callFor(provider, "fullName").state.context).toBeUndefined();
  });

  it("Node level on a leaf path", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(schema, {
        rules: { fullName: nameRule },
        nodeContext: { fullName: "Legal name as in the ID" },
      })
      .safeParse(data);
    expect((provider.calls[0]?.state.context as { notes: string[] }).notes).toContain(
      "Legal name as in the ID",
    );
  });

  it("Rule level", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(schema, {
        rules: { fullName: semantic({ intent: "A name", context: { audience: "children" } }) },
      })
      .safeParse(data);
    expect(provider.calls[0]?.state.context).toEqual({ audience: "children" });
  });

  it("Basic string rule form has no rule context", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(schema, { rules: { fullName: nameRule }, context: { purpose: "signup" } })
      .safeParse(data);
    expect(provider.calls[0]?.state.context).toEqual({ purpose: "signup" });
  });

  it("Unknown node path", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(schema, {
        rules: { fullName: nameRule },
        nodeContext: { nickname: "x" } as never,
      }),
    ).toThrowError(expect.objectContaining({ code: "unknown_path", path: "nickname" }));
  });

  it("Node path on an array", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(
        z.object({ tags: z.array(z.string()) }),
        {
          rules: {},
          nodeContext: { tags: "x" } as never,
        },
      ),
    ).toThrowError(expect.objectContaining({ code: "unsupported_node" }));
  });

  it("Node context without a rule beneath it is allowed", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(schema, {
        rules: { fullName: nameRule },
        nodeContext: { address: { locale: "es" } },
      })
      .safeParse(data);
    expect(provider.calls[0]?.state.context).toBeUndefined();
  });
});

describe("deterministic merge", () => {
  it("Rule with no context inherits everything above", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider, context: { domain: "hr" } })
      .define(schema, {
        rules: { fullName: nameRule },
        context: { purpose: "signup" },
        nodeContext: { fullName: { channel: "web" } },
      })
      .safeParse(data);
    expect(provider.calls[0]?.state.context).toEqual({
      domain: "hr",
      purpose: "signup",
      channel: "web",
    });
  });

  it("Three-level conflict resolves to the most specific", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider, context: { audience: "public" } })
      .define(schema, {
        rules: {
          fullName: semantic({ intent: "A name", context: { audience: "freelancers" } }),
        },
        context: { audience: "clients" },
      })
      .safeParse(data);
    expect(provider.calls[0]?.state.context).toEqual({ audience: "freelancers" });
  });

  it("Node beats schema, rule beats node", async () => {
    const withRule = mockProvider();
    await createEDcheck({ provider: withRule })
      .define(schema, {
        rules: {
          fullName: semantic({ intent: "A name", context: { locale: "es-BO" } }),
        },
        context: { locale: "en" },
        nodeContext: { fullName: { locale: "es" } },
      })
      .safeParse(data);
    expect(withRule.calls[0]?.state.context).toEqual({ locale: "es-BO" });

    const withoutRule = mockProvider();
    await createEDcheck({ provider: withoutRule })
      .define(schema, {
        rules: { fullName: nameRule },
        context: { locale: "en" },
        nodeContext: { fullName: { locale: "es" } },
      })
      .safeParse(data);
    expect(withoutRule.calls[0]?.state.context).toEqual({ locale: "es" });
  });

  it("Ancestor node order", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(schema, {
        rules: { "address.street": semantic("A street") },
        nodeContext: {
          address: { locale: "en", notes: ["a"] },
          "address.street": { locale: "es", notes: ["b"] },
        },
      })
      .safeParse(data);
    expect(provider.calls[0]?.state.context).toEqual({ locale: "es", notes: ["a", "b"] });
  });

  it("Notes accumulate across levels in inheritance order", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider, context: "I" })
      .define(schema, {
        rules: { fullName: semantic({ intent: "A name", context: "R" }) },
        context: "S",
        nodeContext: { fullName: "N" },
      })
      .safeParse(data);
    expect(provider.calls[0]?.state.context).toEqual({ notes: ["I", "S", "N", "R"] });
  });

  it("String never overrides structured keys", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(schema, {
        rules: { fullName: semantic({ intent: "A name", context: "Focus on tone" }) },
        context: { domain: "software", locale: "es" },
      })
      .safeParse(data);
    expect(provider.calls[0]?.state.context).toEqual({
      domain: "software",
      locale: "es",
      notes: ["Focus on tone"],
    });
  });

  it("Open keys follow the same precedence", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider, context: { tenant: "a", plan: "free" } })
      .define(schema, {
        rules: { fullName: semantic({ intent: "A name", context: { tenant: "b" } }) },
      })
      .safeParse(data);
    expect(provider.calls[0]?.state.context).toEqual({ tenant: "b", plan: "free" });
  });

  it("Key insertion order is stable", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider, context: { domain: "x" } })
      .define(schema, {
        rules: { fullName: semantic({ intent: "A name", context: { locale: "es", domain: "y" } }) },
      })
      .safeParse(data);
    expect(Object.keys(provider.calls[0]?.state.context as object)).toEqual(["domain", "locale"]);
  });

  it("Notes are always last", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider, context: "note" })
      .define(schema, {
        rules: { fullName: semantic({ intent: "A name", context: { domain: "x" } }) },
      })
      .safeParse(data);
    expect(Object.keys(provider.calls[0]?.state.context as object)).toEqual(["domain", "notes"]);
  });

  it("Merge is resolved at define time", async () => {
    const provider = mockProvider();
    const context = { domain: "a" };
    const bound = createEDcheck({ provider, context }).define(schema, {
      rules: { fullName: nameRule },
    });
    context.domain = "b";
    await bound.safeParse(data);
    expect(provider.calls[0]?.state.context).toEqual({ domain: "a" });
  });
});

describe("reserved keys and locale semantics", () => {
  it("Locale only appears in state", async () => {
    const withLocale = mockProvider();
    const without = mockProvider();
    const rules = { fullName: nameRule };
    await createEDcheck({ provider: withLocale })
      .define(schema, { rules, context: { locale: "es-BO" } })
      .safeParse(data);
    await createEDcheck({ provider: without }).define(schema, { rules }).safeParse(data);
    expect(withLocale.calls[0]?.questions).toEqual(without.calls[0]?.questions);
    expect(withLocale.calls[0]?.state.context).toEqual({ locale: "es-BO" });
    expect(without.calls[0]?.state.context).toBeUndefined();
  });
});

describe("context travels only in state", () => {
  it("Instructions are identical with and without context", async () => {
    const withContext = mockProvider();
    const without = mockProvider();
    const rules = { fullName: nameRule };
    await createEDcheck({ provider: withContext })
      .define(schema, {
        rules,
        context: { domain: "unique-marker-domain", notes: ["unique-marker-note"] },
      })
      .safeParse(data);
    await createEDcheck({ provider: without }).define(schema, { rules }).safeParse(data);
    const serialized = JSON.stringify(withContext.calls[0]?.questions);
    expect(serialized).not.toContain("unique-marker-domain");
    expect(serialized).not.toContain("unique-marker-note");
    expect(withContext.calls[0]?.questions).toEqual(without.calls[0]?.questions);
  });

  it("Rule path named context is rejected", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(z.object({ context: z.string() }), {
        rules: { context: semantic("A context field") },
      }),
    ).toThrowError(expect.objectContaining({ code: "reserved_path", path: "context" }));
  });

  it("Nested rule path under context is rejected", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(
        z.object({ context: z.object({ value: z.string() }) }),
        { rules: { "context.value": semantic("A value") } },
      ),
    ).toThrowError(expect.objectContaining({ code: "reserved_path" }));
  });

  it("Node context path named context is rejected", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(
        z.object({ context: z.string(), fullName: z.string() }),
        {
          rules: { fullName: nameRule },
          nodeContext: { context: "x" },
        },
      ),
    ).toThrowError(expect.objectContaining({ code: "reserved_path" }));
  });

  it("A field named context without rules is fine", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(z.object({ context: z.string(), fullName: z.string() }), {
        rules: { fullName: nameRule },
        context: { domain: "hr" },
      })
      .safeParse({ context: "user-supplied", fullName: "Ana Pérez" });
    expect(provider.calls[0]?.state).toEqual({
      fullName: "Ana Pérez",
      context: { domain: "hr" },
    });
  });
});
