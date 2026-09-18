import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createEDcheck, mockProvider, semantic } from "edcheck";

const Person = z.object({
  fullName: z.string(),
  age: z.number(),
  occupation: z.string(),
  bio: z.string().optional(),
  address: z.object({
    city: z.string(),
    country: z.string(),
    street: z.string(),
  }),
  tags: z.array(z.string()),
  items: z.array(z.object({ name: z.string() })),
});

const ageOccupation = semantic({
  intent: "The `occupation` is plausible given `age`",
});

describe("cross-field binding", () => {
  it("Two-path binding on primitive leaves", () => {
    const bound = createEDcheck({ provider: mockProvider() }).define(Person, {
      rules: {},
      crossField: [{ paths: ["age", "occupation"], rule: semantic("Coherent") }],
    });
    expect(bound.schema).toBe(Person);
  });

  it("Nested and object paths", () => {
    const edcheck = createEDcheck({ provider: mockProvider() });
    expect(() =>
      edcheck.define(Person, {
        rules: {},
        crossField: [{ paths: ["address.city", "address.country"], rule: semantic("Place") }],
      }),
    ).not.toThrow();
    expect(() =>
      edcheck.define(Person, {
        rules: {},
        crossField: [{ paths: ["address"], rule: semantic("Address") }],
      }),
    ).not.toThrow();
  });

  it("Single path is allowed", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(Person, {
        rules: {},
        crossField: [{ paths: ["bio"], rule: semantic("A biography") }],
      })
      .safeParse({
        fullName: "Ana",
        age: 30,
        occupation: "Engineer",
        bio: "Works in Madrid",
        address: { city: "Madrid", country: "ES", street: "Gran Vía" },
        tags: [],
        items: [],
      });
    expect(provider.calls[0]?.questions["bio"]?.instructions).toContain("`bio`");
    expect(provider.calls[0]?.questions["bio"]?.instructions).not.toContain(" and ");
  });

  it("Empty paths", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(Person, {
        rules: {},
        crossField: [{ paths: [], rule: semantic("x") } as never],
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_paths" }));
  });

  it("Duplicate paths", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(Person, {
        rules: {},
        crossField: [{ paths: ["age", "age"], rule: semantic("x") }],
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_paths" }));
  });

  it("Unknown declared path", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(Person, {
        rules: {},
        crossField: [{ paths: ["age", "salary"], rule: semantic("x") } as never],
      }),
    ).toThrowError(expect.objectContaining({ code: "unknown_path", path: "salary" }));
  });

  it("Declared path on or through an array", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(Person, {
        rules: {},
        crossField: [{ paths: ["tags"], rule: semantic("x") } as never],
      }),
    ).toThrowError(expect.objectContaining({ code: "unsupported_node" }));
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(Person, {
        rules: {},
        crossField: [{ paths: ["items.name"], rule: semantic("x") } as never],
      }),
    ).toThrowError(expect.objectContaining({ code: "unsupported_node" }));
  });

  it("Declared path on a transformed node", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(
        z.object({ name: z.string().transform((value) => value.toUpperCase()) }),
        {
          rules: {},
          crossField: [{ paths: ["name"], rule: semantic("x") }],
        },
      ),
    ).toThrowError(expect.objectContaining({ code: "unsupported_node" }));
  });

  it("Missing rule", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(Person, {
        rules: {},
        crossField: [{ paths: ["age"] } as never],
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_option" }));
  });

  it("Same rule object in two bindings", async () => {
    const provider = mockProvider();
    const shared = semantic("Shared");
    await createEDcheck({ provider })
      .define(Person, {
        rules: {},
        crossField: [
          { paths: ["age", "occupation"], rule: shared },
          { paths: ["bio", "occupation"], rule: shared },
        ],
      })
      .safeParse({
        fullName: "Ana",
        age: 30,
        occupation: "Engineer",
        bio: "Works in Madrid",
        address: { city: "Madrid", country: "ES", street: "Gran Vía" },
        tags: [],
        items: [],
      });
    expect(Object.keys(provider.calls[0]?.questions ?? {})).toEqual([
      "age+occupation",
      "bio+occupation",
    ]);
  });

  it("Default id joins the paths", async () => {
    const provider = mockProvider({ answers: { "address.city+address.country": 0.1 } });
    const result = await createEDcheck({ provider })
      .define(Person, {
        rules: {},
        crossField: [{ paths: ["address.city", "address.country"], rule: semantic("Place") }],
      })
      .safeParse({
        fullName: "Ana",
        age: 30,
        occupation: "Engineer",
        address: { city: "Madrid", country: "ES", street: "Gran Vía" },
        tags: [],
        items: [],
      });
    expect(Object.keys(provider.calls[0]?.questions ?? {})).toEqual([
      "address.city+address.country",
    ]);
    expect(result.issues[0]?.ruleId).toBe("address.city+address.country");
  });

  it("Duplicate id across field and cross-field rules", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(Person, {
        rules: { fullName: semantic({ intent: "A name", id: "x" }) },
        crossField: [{ paths: ["age", "occupation"], rule: semantic({ intent: "C", id: "x" }) }],
      }),
    ).toThrowError(expect.objectContaining({ code: "duplicate_rule_id" }));
  });

  it("A path shared with a field rule", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(Person, {
        rules: { occupation: semantic("A job") },
        crossField: [{ paths: ["age", "occupation"], rule: semantic("Coherent") }],
      })
      .safeParse({
        fullName: "Ana",
        age: 30,
        occupation: "Engineer",
        address: { city: "Madrid", country: "ES", street: "Gran Vía" },
        tags: [],
        items: [],
      });
    expect(provider.calls[0]?.state).toEqual({ occupation: "Engineer", age: 30 });
  });
});

describe("backtick references", () => {
  it("Declared references compile", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(Person, {
        rules: {},
        crossField: [{ paths: ["age", "occupation"], rule: ageOccupation }],
      }),
    ).not.toThrow();
  });

  it("Undeclared reference is rejected", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(Person, {
        rules: {},
        crossField: [
          {
            paths: ["age", "occupation"],
            rule: semantic("The `salary` is high"),
          },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "unknown_reference" }));
    try {
      createEDcheck({ provider: mockProvider() }).define(Person, {
        rules: {},
        crossField: [
          { paths: ["age", "occupation"], rule: semantic("The `salary` is high") },
        ],
      });
    } catch (error) {
      expect((error as Error).message).toContain("salary");
    }
  });

  it("References in criteria are validated", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(Person, {
        rules: {},
        crossField: [
          {
            paths: ["age", "occupation"],
            rule: semantic({
              intent: "Occupation matches age",
              invalid: "The `salary` is wrong",
            }),
          },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "unknown_reference" }));
  });

  it("Nested declared reference", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(Person, {
        rules: {},
        crossField: [
          {
            paths: ["address.city", "address.country"],
            rule: semantic("The `address.city` matches the country"),
          },
        ],
      }),
    ).not.toThrow();
  });

  it("Reference to a parent object path", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(Person, {
        rules: {},
        crossField: [{ paths: ["address"], rule: semantic("The `address` is complete") }],
      }),
    ).not.toThrow();
  });

  it("Non-path-like backticks are ignored", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(Person, {
        rules: {},
        crossField: [
          {
            paths: ["age", "occupation"],
            rule: semantic("Treat `N/A`, `senior engineer` and `15 years` as prose"),
          },
        ],
      }),
    ).not.toThrow();
  });

  it("Field rules are not scanned", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() }).define(Person, {
        rules: { fullName: semantic("Mentions `unrelated` on purpose") },
      }),
    ).not.toThrow();
  });
});
