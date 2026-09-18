import { expectTypeOf, test } from "vitest";

import { mockProvider, type MockProvider, type SemanticProvider } from "edcheck";

test("an object literal satisfies SemanticProvider", () => {
  const provider: SemanticProvider = {
    name: "x",
    evaluate: async (request) => ({
      model: "m",
      answers: Object.fromEntries(
        Object.keys(request.questions).map((id) => [id, { type: "noul" as const, noul: 1 }]),
      ),
    }),
  };
  expectTypeOf(provider).toMatchTypeOf<SemanticProvider>();
});

test("MockProvider is assignable to SemanticProvider", () => {
  const provider = mockProvider();
  expectTypeOf(provider).toMatchTypeOf<SemanticProvider>();
  expectTypeOf(provider).toMatchTypeOf<MockProvider>();
});
