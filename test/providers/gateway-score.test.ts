import { describe, expect, it } from "vitest";
import { gatewayProvider } from "edcheck";

import { gatewayMockModel } from "../helpers/gateway-mock-model.ts";

const scoreQuestion = {
  type: "score" as const,
  instructions: "Rate",
  criteria: ["poor", "ok", "good"],
};

function providerWith(doEvaluate: Parameters<typeof gatewayMockModel>[0]) {
  return gatewayProvider({
    maxRetries: 0,
    model: gatewayMockModel(doEvaluate),
  });
}

describe("gateway Score normalization", () => {
  it("passes a score question through", async () => {
    let received: unknown;
    const provider = providerWith(async (call) => {
      received = call.questions;
      return {
        answers: {
          q: { type: "score", score: 1.7, probabilities: { "0": 0.1, "1": 0.1, "2": 0.8 } },
        },
        providerMetadata: { typesafe: { confidence: { q: 0.9 } } },
      };
    });
    await provider.evaluate(
      { state: { description: "A library" }, questions: { q: scoreQuestion } },
      { signal: new AbortController().signal },
    );
    expect(received).toEqual({ q: scoreQuestion });
  });

  it("normalizes a score answer and reads confidence", async () => {
    const provider = providerWith(async () => ({
      answers: {
        q: { type: "score", score: 1.7, probabilities: { "0": 0.1, "1": 0.1, "2": 0.8 } },
      },
      providerMetadata: { typesafe: { confidence: { q: 0.9 } } },
    }));
    const response = await provider.evaluate(
      { state: { description: "A library" }, questions: { q: scoreQuestion } },
      { signal: new AbortController().signal },
    );
    expect(response.answers.q).toEqual({
      type: "score",
      score: 1.7,
      probabilities: [0.1, 0.1, 0.8],
      confidence: 0.9,
    });
  });

  it("treats a missing distribution as malformed", async () => {
    const provider = providerWith(async () => ({
      answers: { q: { type: "score", score: 1 } },
      providerMetadata: { typesafe: { confidence: { q: 0.9 } } },
    }));
    const error = await provider
      .evaluate(
        { state: { description: "A library" }, questions: { q: scoreQuestion } },
        { signal: new AbortController().signal },
      )
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "malformed_response" });
  });

  it("treats non-contiguous distribution keys as malformed", async () => {
    const provider = providerWith(async () => ({
      answers: {
        q: { type: "score", score: 1, probabilities: { "0": 0.5, "2": 0.5 } },
      },
      providerMetadata: { typesafe: { confidence: { q: 0.9 } } },
    }));
    const error = await provider
      .evaluate(
        { state: { description: "A library" }, questions: { q: scoreQuestion } },
        { signal: new AbortController().signal },
      )
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "malformed_response" });
  });

  it("treats missing confidence as malformed", async () => {
    const provider = providerWith(async () => ({
      answers: {
        q: { type: "score", score: 1.7, probabilities: { "0": 0.1, "1": 0.1, "2": 0.8 } },
      },
    }));
    const error = await provider
      .evaluate(
        { state: { description: "A library" }, questions: { q: scoreQuestion } },
        { signal: new AbortController().signal },
      )
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "malformed_response" });
  });

  it("maps a mixed noul and score request", async () => {
    const provider = providerWith(async () => ({
      answers: {
        n: { type: "boolean", probability: 0.9 },
        s: { type: "score", score: 2, probabilities: { "0": 0, "1": 0, "2": 1 } },
      },
      providerMetadata: { typesafe: { confidence: { s: 1 } } },
    }));
    const response = await provider.evaluate(
      {
        state: { fullName: "Ana", description: "A library" },
        questions: {
          n: { type: "noul", instructions: "name" },
          s: scoreQuestion,
        },
      },
      { signal: new AbortController().signal },
    );
    expect(response.answers.n?.type).toBe("noul");
    expect(response.answers.s?.type).toBe("score");
  });
});
