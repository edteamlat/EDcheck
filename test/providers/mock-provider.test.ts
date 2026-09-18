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
    expect(response.answers.fullName?.noul).toBe(0.12);
    expect(response.answers.bio?.noul).toBe(0.9);
  });

  it("answers by function", async () => {
    const provider = mockProvider({
      answers: (_question, id) => (id === "bio" ? 0.5 : 1),
    });
    const response = await provider.evaluate(twoQuestions, { signal: new AbortController().signal });
    expect(response.answers.bio?.noul).toBe(0.5);
    expect(response.answers.fullName?.noul).toBe(1);
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
