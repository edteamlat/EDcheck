import { expectTypeOf, test } from "vitest";

import {
  mockProvider,
  type MockProvider,
  type SemanticAnswer,
  type SemanticProvider,
} from "edcheck";

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

test("SemanticAnswer narrows on type", () => {
  function inspect(answer: SemanticAnswer): number {
    if (answer.type === "score") {
      expectTypeOf(answer.probabilities).toEqualTypeOf<readonly number[]>();
      expectTypeOf(answer.confidence).toEqualTypeOf<number>();
      return answer.score;
    }
    expectTypeOf(answer.noul).toEqualTypeOf<number>();
    return answer.noul;
  }
  inspect({ type: "score", score: 2, probabilities: [0, 0, 1], confidence: 1 });
  inspect({ type: "noul", noul: 0.9 });
});

test("a provider can switch on question.type", () => {
  const provider: SemanticProvider = {
    name: "switch",
    evaluate: async (request) => ({
      model: "m",
      answers: Object.fromEntries(
        Object.entries(request.questions).map(([id, question]) => [
          id,
          question.type === "score"
            ? { type: "score" as const, score: 2, probabilities: [0, 0, 1], confidence: 1 }
            : { type: "noul" as const, noul: 0.9 },
        ]),
      ),
    }),
  };
  expectTypeOf(provider).toMatchTypeOf<SemanticProvider>();
});
