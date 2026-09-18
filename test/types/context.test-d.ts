import { expectTypeOf, test } from "vitest";
import { z } from "zod";

import { createEDcheck, mockProvider, semantic, type NodePath } from "edcheck";

const User = z.object({
  fullName: z.string(),
  address: z.object({
    street: z.string(),
  }),
  tags: z.array(z.string()),
});

const edcheck = createEDcheck({
  provider: mockProvider(),
  context: { domain: "hr" },
});

test("Context is accepted at every attachment level", () => {
  createEDcheck({
    provider: mockProvider(),
    context: { locale: "es-BO", tenant: "acme" },
  });
  edcheck.define(User, {
    rules: {
      fullName: semantic({ intent: "A name", context: { audience: "client" } }),
    },
    context: "Schema note",
    nodeContext: {
      address: { locale: "es" },
      fullName: "Legal name",
    },
  });
});

test("nodeContext rejects an unknown path", () => {
  edcheck.define(User, {
    rules: { fullName: semantic("A name") },
    nodeContext: {
      // @ts-expect-error unknown node path
      nickname: "x",
    },
  });
});

test("nodeContext rejects an array path", () => {
  edcheck.define(User, {
    rules: { fullName: semantic("A name") },
    nodeContext: {
      // @ts-expect-error array path
      tags: "x",
    },
  });
});

test("NodePath includes object and leaf paths and excludes arrays", () => {
  type Paths = NodePath<z.output<typeof User>>;
  expectTypeOf<"address">().toExtend<Paths>();
  expectTypeOf<"fullName">().toExtend<Paths>();
  expectTypeOf<"address.street">().toExtend<Paths>();
  expectTypeOf<"tags">().not.toExtend<Paths>();
  expectTypeOf<"nickname">().not.toExtend<Paths>();
});

test("reserved context keys are strings while open keys are unknown", () => {
  createEDcheck({
    provider: mockProvider(),
    // @ts-expect-error locale must be a string
    context: { locale: 42 },
  });
  createEDcheck({
    provider: mockProvider(),
    context: { tenant: 42 },
  });
});

test("the string semantic form has no context overload", () => {
  // @ts-expect-error string form does not accept options
  semantic("x", { context: { domain: "hr" } });
});
