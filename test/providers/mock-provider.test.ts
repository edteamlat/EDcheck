import { describe, expect, it } from "vitest";

import { EDcheckProviderError, mockProvider } from "edcheck";

import type { SemanticRequest } from "../../src/providers/types/index.ts";

const twoQuestions: SemanticRequest = {
  state: { fullName: "Ana" },
  questions: {
    fullName: { type: "noul", instructions: "name" },
    bio: { type: "noul", instructions: "bio" },
  },
};

describe("mockProvider", () => {
  it("answers every question with the default noul and model", async () => {
    const provider = mockProvider();
    const response = await provider.evaluate(twoQuestions, { signal: new AbortController().signal });
    expect(response.model).toBe("mock");
    expect(response.answers).toEqual({
      fullName: { type: "noul", noul: 0.9 },
      bio: { type: "noul", noul: 0.9 },
    });
  });

  it("answers by id and falls back to the default", async () => {
    const provider = mockProvider({ answers: { fullName: 0.12 } });
    const response = await provider.evaluate(twoQuestions, { signal: new AbortController().signal });
    expect(response.answers.fullName).toEqual({ type: "noul", noul: 0.12 });
    expect(response.answers.bio).toEqual({ type: "noul", noul: 0.9 });
  });

  it("answers by function", async () => {
    const provider = mockProvider({
      answers: (_question, id) => (id === "bio" ? 0.5 : 1),
    });
    const response = await provider.evaluate(twoQuestions, { signal: new AbortController().signal });
    expect(response.answers.bio).toEqual({ type: "noul", noul: 0.5 });
    expect(response.answers.fullName).toEqual({ type: "noul", noul: 1 });
  });

  it("records every request", async () => {
    const provider = mockProvider();
    const first = { ...twoQuestions, state: { fullName: "one" } };
    const second = { ...twoQuestions, state: { fullName: "two" } };
    await provider.evaluate(first, { signal: new AbortController().signal });
    await provider.evaluate(second, { signal: new AbortController().signal });
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[0]).toEqual(first);
  });

  it("rejects with the injected error instance", async () => {
    const error = new EDcheckProviderError("http", { status: 500 });
    const provider = mockProvider({ error });
    await expect(
      provider.evaluate(twoQuestions, { signal: new AbortController().signal }),
    ).rejects.toBe(error);
  });

  it("rejects with the abort reason while delaying", async () => {
    const provider = mockProvider({ delayMs: 500 });
    const controller = new AbortController();
    const reason = new Error("stop");
    const started = Date.now();
    const pending = provider.evaluate(twoQuestions, { signal: controller.signal });
    setTimeout(() => controller.abort(reason), 10);
    await expect(pending).rejects.toBe(reason);
    expect(Date.now() - started).toBeLessThan(100);
  });

  it("uses a custom model name", async () => {
    const provider = mockProvider({ model: "jev-test" });
    const response = await provider.evaluate(twoQuestions, { signal: new AbortController().signal });
    expect(response.model).toBe("jev-test");
  });
});

const scoreQuestion: SemanticRequest = {
  state: { description: "A library" },
  questions: {
    d: {
      type: "score",
      instructions: "Rate `description` on this scale: clarity",
      criteria: ["meaningless", "vague", "clear"],
    },
  },
};

describe("mock provider score answers", () => {
  it("answers from an object and computes the weighted score", async () => {
    const provider = mockProvider({
      answers: { d: { probabilities: [0.2, 0.3, 0.5], confidence: 0.7 } },
    });
    const response = await provider.evaluate(scoreQuestion, {
      signal: new AbortController().signal,
    });
    expect(response.answers.d).toEqual({
      type: "score",
      score: 1.3,
      probabilities: [0.2, 0.3, 0.5],
      confidence: 0.7,
    });
    const answer = response.answers.d;
    expect(answer?.type).toBe("score");
    if (answer?.type === "score") {
      expect(Math.abs(answer.score - 1.3)).toBeLessThan(1e-9);
    }
  });

  it("defaults confidence to 1", async () => {
    const provider = mockProvider({ answers: { d: { probabilities: [0, 1, 0] } } });
    const response = await provider.evaluate(scoreQuestion, {
      signal: new AbortController().signal,
    });
    expect(response.answers.d).toMatchObject({ type: "score", confidence: 1 });
  });

  it("defaults a score answer to the last level", async () => {
    const provider = mockProvider();
    const response = await provider.evaluate(scoreQuestion, {
      signal: new AbortController().signal,
    });
    expect(response.answers.d).toEqual({
      type: "score",
      score: 2,
      probabilities: [0, 0, 1],
      confidence: 1,
    });
  });

  it("passes the question to a function answers map", async () => {
    const mixed: SemanticRequest = {
      state: { fullName: "Ana", description: "A library" },
      questions: {
        n: { type: "noul", instructions: "name" },
        s: { type: "score", instructions: "scale", criteria: ["bad", "good"] },
      },
    };
    const provider = mockProvider({
      answers: (question) => (question.type === "score" ? { probabilities: [1, 0] } : 0.5),
    });
    const response = await provider.evaluate(mixed, { signal: new AbortController().signal });
    expect(response.answers.n).toEqual({ type: "noul", noul: 0.5 });
    expect(response.answers.s).toMatchObject({ type: "score", probabilities: [1, 0] });
  });

  it("throws a plain Error when a number answers a score question", async () => {
    const provider = mockProvider({ answers: { d: 0.9 } });
    const error = await provider
      .evaluate(scoreQuestion, { signal: new AbortController().signal })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(EDcheckProviderError);
  });

  it("answers a mixed request by id", async () => {
    const mixed: SemanticRequest = {
      state: { fullName: "Ana", description: "A library" },
      questions: {
        n: { type: "noul", instructions: "name" },
        s: { type: "score", instructions: "scale", criteria: ["bad", "good"] },
      },
    };
    const provider = mockProvider({
      answers: { n: 0.2, s: { probabilities: [0, 1] } },
    });
    const response = await provider.evaluate(mixed, { signal: new AbortController().signal });
    expect(response.answers.n).toEqual({ type: "noul", noul: 0.2 });
    expect(response.answers.s?.type).toBe("score");
  });
});
