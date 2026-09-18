import { expectTypeOf, test } from "vitest";
import { z } from "zod";

import {
  createEDcheck,
  mockProvider,
  semantic,
  type Issue,
  type SemanticResult,
} from "edcheck";

const User = z.object({
  fullName: z.string(),
  bio: z.string().optional(),
  address: z.object({
    street: z.string(),
    city: z.object({
      name: z.string(),
    }),
  }),
  tags: z.array(z.string()),
  items: z.array(z.object({ name: z.string() })),
});

const edcheck = createEDcheck({ provider: mockProvider() });

test("data is z.output of the schema", async () => {
  const bound = edcheck.define(User, {
    rules: { fullName: semantic("A name") },
  });
  const result = await bound.safeParse({
    fullName: "Ana",
    address: { street: "A", city: { name: "B" } },
    tags: [],
    items: [],
  });
  expectTypeOf(result.data).toEqualTypeOf<z.output<typeof User> | undefined>();
});

test("unknown rule key is a type error", () => {
  edcheck.define(User, {
    rules: {
      // @ts-expect-error unknown field
      nickname: semantic("A nickname"),
    },
  });
});

test("nested and optional keys are accepted", () => {
  edcheck.define(User, {
    rules: {
      "address.street": semantic("A street"),
      bio: semantic("A bio"),
      "address.city.name": semantic("A city"),
    },
  });
});

test("array field paths are rejected", () => {
  edcheck.define(User, {
    rules: {
      // @ts-expect-error array field
      tags: semantic("Tags"),
    },
  });
});

test("paths through arrays are rejected", () => {
  edcheck.define(User, {
    rules: {
      // @ts-expect-error path through an array
      "items.name": semantic("Item name"),
    },
  });
});

test("Issue and SemanticResult are exported", () => {
  expectTypeOf<SemanticResult<{ a: string }>["issues"]>().toEqualTypeOf<Issue[]>();
  expectTypeOf<SemanticResult<{ a: string }>["data"]>().toEqualTypeOf<{ a: string } | undefined>();
});
