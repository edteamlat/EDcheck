import { expectTypeOf, test } from "vitest";
import { z } from "zod";

import {
  createEDcheck,
  mockProvider,
  semantic,
  type PathValue,
  type SemanticNode,
  type SemanticResult,
  type SemanticSchema,
} from "edcheck";

const User = z.object({
  fullName: z.string(),
  nickname: z.string().optional(),
  address: z.object({
    street: z.string(),
    city: z.string(),
  }),
  tags: z.array(z.string()),
  items: z.array(z.object({ name: z.string() })),
});

const UserSemantic = createEDcheck({ provider: mockProvider() }).define(User, {
  rules: { fullName: semantic("A name") },
});

test("Leaf path types data", async () => {
  const result = await UserSemantic.node("fullName").safeParse("Ada");
  expectTypeOf(result).toEqualTypeOf<SemanticResult<string>>();
  expectTypeOf(result.data).toEqualTypeOf<string | undefined>();
});

test("Object path types data as the sub-object", async () => {
  const result = await UserSemantic.node("address").safeParse({
    street: "Main",
    city: "Lima",
  });
  expectTypeOf(result.data).toEqualTypeOf<{ street: string; city: string } | undefined>();
});

test("Optional leaf", async () => {
  const result = await UserSemantic.node("nickname").safeParse(undefined);
  expectTypeOf(result.data).toEqualTypeOf<string | undefined>();
});

test("Invalid paths are rejected at compile time", () => {
  // @ts-expect-error unknown path
  UserSemantic.node("nope");
  // @ts-expect-error array path
  UserSemantic.node("tags");
  // @ts-expect-error path through an array
  UserSemantic.node("items.name");
  // @ts-expect-error empty path
  UserSemantic.node("");
});

test("Exported types", () => {
  expectTypeOf<PathValue<{ a: { b: number } }, "a.b">>().toEqualTypeOf<number>();
  expectTypeOf(UserSemantic.node("fullName")).toMatchTypeOf<
    SemanticNode<typeof User, "fullName">
  >();
  expectTypeOf(UserSemantic).toMatchTypeOf<SemanticSchema<typeof User>>();
});
