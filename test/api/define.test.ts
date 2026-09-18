import { describe, expect, it } from "vitest";

import { createEDcheck, mockProvider, semantic } from "edcheck";
import { z } from "zod";

import { expectConfigError } from "../helpers/expect-config-error.ts";

const nameRule = semantic("A plausible full name for a real person");

function instance() {
  return createEDcheck({ provider: mockProvider() });
}

describe("define() binding rules to leaf paths", () => {
  it("accepts a top-level primitive and keeps the Zod schema reference", () => {
    const schema = z.object({ fullName: z.string(), age: z.number() });
    const bound = instance().define(schema, { rules: { fullName: nameRule } });
    expect(bound.schema).toBe(schema);
  });

  it("accepts a nested dotted path", () => {
    const schema = z.object({ address: z.object({ street: z.string() }) });
    expect(() =>
      instance().define(schema, { rules: { "address.street": nameRule } }),
    ).not.toThrow();
  });

  it("accepts wrapped primitive leaves", () => {
    const schema = z.object({
      optional: z.string().optional(),
      nullable: z.string().nullable(),
      fallback: z.string().default("x"),
      choice: z.enum(["a", "b"]),
      flag: z.literal("ok"),
    });
    expect(() =>
      instance().define(schema, {
        rules: {
          optional: nameRule,
          nullable: nameRule,
          fallback: nameRule,
          choice: nameRule,
          flag: nameRule,
        },
      }),
    ).not.toThrow();
  });

  it("rejects an unknown path", () => {
    expectConfigError(
      () =>
        instance().define(z.object({ fullName: z.string() }), {
          rules: { nickname: nameRule } as never,
        }),
      "unknown_path",
      "nickname",
    );
  });

  it("rejects an unknown nested segment", () => {
    expectConfigError(
      () =>
        instance().define(z.object({ address: z.object({ street: z.string() }) }), {
          rules: { "address.zip": nameRule } as never,
        }),
      "unknown_path",
      "address.zip",
    );
  });

  it("rejects a rule on an array node", () => {
    try {
      instance().define(z.object({ tags: z.array(z.string()) }), {
        rules: { tags: nameRule } as never,
      });
      expect.fail("expected config error");
    } catch (error) {
      expect(error).toMatchObject({ code: "unsupported_node" });
      expect((error as Error).message).toMatch(/array/i);
      expect((error as Error).message).toMatch(/v1/);
    }
  });

  it("rejects a rule through an array", () => {
    const schema = z.object({ items: z.array(z.object({ name: z.string() })) });
    expectConfigError(
      () => instance().define(schema, { rules: { "items.0.name": nameRule } as never }),
      "unsupported_node",
    );
    expectConfigError(
      () => instance().define(schema, { rules: { "items.name": nameRule } as never }),
      "unsupported_node",
    );
  });

  it("rejects a rule on an object node", () => {
    expectConfigError(
      () =>
        instance().define(z.object({ address: z.object({ street: z.string() }) }), {
          rules: { address: nameRule } as never,
        }),
      "unsupported_node",
    );
  });

  it("rejects a rule on a transformed node", () => {
    expectConfigError(
      () =>
        instance().define(z.object({ length: z.string().transform((value) => value.length) }), {
          rules: { length: nameRule } as never,
        }),
      "unsupported_node",
    );
  });

  it("rejects a root schema that is not an object", () => {
    const edcheck = instance() as unknown as {
      define: (schema: unknown, options: { rules: object }) => unknown;
    };
    expectConfigError(() => edcheck.define(z.string(), { rules: {} }), "unsupported_schema");
  });

  it("rejects duplicate rule ids", () => {
    const shared = semantic({ intent: "A name", id: "same" });
    expectConfigError(
      () =>
        instance().define(z.object({ fullName: z.string(), bio: z.string() }), {
          rules: { fullName: shared, bio: shared },
        }),
      "duplicate_rule_id",
    );
  });

  it("accepts an empty rules map", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(z.object({ fullName: z.string() }), {
      rules: {},
    });
    await bound.safeParse({ fullName: "Ana" });
    expect(provider.calls).toHaveLength(0);
  });

  it("validates schema-level thresholds against the effective merge", () => {
    const edcheck = createEDcheck({
      provider: mockProvider(),
      thresholds: { pass: 0.9 },
    });
    expectConfigError(
      () =>
        edcheck.define(z.object({ fullName: z.string() }), {
          rules: { fullName: nameRule },
          thresholds: { fail: 0.95 },
        }),
      "invalid_thresholds",
    );
  });

  it("does not mutate the Zod schema", () => {
    const schema = z.object({ fullName: z.string() });
    const shapeBefore = schema.shape;
    const parseBefore = schema.safeParse({ fullName: "Ana" });
    const keysBefore = Object.keys(schema);
    instance().define(schema, { rules: { fullName: nameRule } });
    expect(schema.shape).toBe(shapeBefore);
    expect(Object.keys(schema)).toEqual(keysBefore);
    expect(schema.safeParse({ fullName: "Ana" }).success).toBe(parseBefore.success);
  });

  it("allows the same rule instance on two schemas", () => {
    const rule = semantic("A plausible full name for a real person");
    const first = instance().define(z.object({ fullName: z.string() }), {
      rules: { fullName: rule },
    });
    const second = instance().define(z.object({ legalName: z.string() }), {
      rules: { legalName: rule },
    });
    expect(first.schema.shape.fullName).toBeDefined();
    expect(second.schema.shape.legalName).toBeDefined();
  });
});
