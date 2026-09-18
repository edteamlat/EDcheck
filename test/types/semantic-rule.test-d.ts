import { expectTypeOf, test } from "vitest";

import { semantic, type SemanticRule, type Severity } from "edcheck";

test("semantic() returns SemanticRule", () => {
  expectTypeOf(semantic("A name")).toEqualTypeOf<SemanticRule>();
});

test("severity is a literal union", () => {
  expectTypeOf<Severity>().toEqualTypeOf<"error" | "warning" | "info">();
});
