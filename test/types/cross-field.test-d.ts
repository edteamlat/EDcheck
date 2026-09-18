import { expectTypeOf, test } from "vitest";
import { z } from "zod";

import { createEDcheck, mockProvider, semantic, type Issue } from "edcheck";

const Person = z.object({
  age: z.number(),
  occupation: z.string(),
  address: z.object({ city: z.string() }),
  tags: z.array(z.string()),
});

const edcheck = createEDcheck({ provider: mockProvider() });

test("valid tuple compiles", () => {
  edcheck.define(Person, {
    rules: {},
    crossField: [
      { paths: ["age", "occupation"], rule: semantic("Coherent") },
      { paths: ["address"], rule: semantic("Address") },
    ],
  });
});

test("unknown path is a type error", () => {
  edcheck.define(Person, {
    rules: {},
    crossField: [
      {
        // @ts-expect-error unknown declared path
        paths: ["age", "salary"],
        rule: semantic("x"),
      },
    ],
  });
});

test("array path is a type error", () => {
  edcheck.define(Person, {
    rules: {},
    crossField: [
      {
        // @ts-expect-error array path
        paths: ["tags"],
        rule: semantic("x"),
      },
    ],
  });
});

test("empty tuple is a type error", () => {
  edcheck.define(Person, {
    rules: {},
    crossField: [
      {
        // @ts-expect-error empty paths
        paths: [],
        rule: semantic("x"),
      },
    ],
  });
});

test("crossField is optional", () => {
  edcheck.define(Person, {
    rules: { occupation: semantic("A job") },
  });
});

test("Issue paths is optional arrays of path arrays", () => {
  expectTypeOf<Issue["paths"]>().toEqualTypeOf<(string | number)[][] | undefined>();
});
