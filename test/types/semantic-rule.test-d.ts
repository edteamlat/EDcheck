import { expectTypeOf, test } from "vitest";

import { semantic, type NoulRule, type SemanticRule, type Severity } from "edcheck";

test("semantic() returns a NoulRule assignable to SemanticRule", () => {
  expectTypeOf(semantic("A name")).toEqualTypeOf<NoulRule>();
  expectTypeOf(semantic("A name")).toMatchTypeOf<SemanticRule>();
});

test("severity is a literal union", () => {
  expectTypeOf<Severity>().toEqualTypeOf<"error" | "warning" | "info">();
});
