import { describe, expect, it } from "vitest";
import {
  APICallError,
  InvalidArgumentError,
  InvalidResponseDataError,
} from "ai";
import { EDcheckConfigError, gatewayProvider, type EDcheckProviderError } from "edcheck";

import { gatewayMockModel } from "../helpers/gateway-mock-model.ts";
import { gatewayNoulRequest } from "../helpers/gateway-noul-request.ts";

const noul = gatewayNoulRequest();

function providerWith(
  doEvaluate: Parameters<typeof gatewayMockModel>[0],
  options: { maxRetries?: number; supportedQuestionTypes?: Array<"choice" | "score" | "boolean"> } = {},
) {
  return gatewayProvider({
    maxRetries: options.maxRetries ?? 0,
    model: gatewayMockModel(doEvaluate, options),
  });
}

describe("gateway request and response normalization", () => {
  it("turns a noul question into a boolean question", async () => {
    let received: { state?: unknown; questions?: unknown } = {};
    const provider = providerWith(async (call) => {
      received = call;
      return { answers: { r1: { type: "boolean", probability: 0.83 } } };
    });
    await provider.evaluate(noul, { signal: new AbortController().signal });
    expect(received.state).toEqual({ name: "x" });
    expect(received.questions).toEqual({
      r1: { type: "boolean", instructions: "i", criteria: { true: "t", false: "f" } },
    });
  });

  it("omits criteria when the noul question has none", async () => {
    let questions: unknown;
    const provider = providerWith(async (call) => {
      questions = call.questions;
      return { answers: { r1: { type: "boolean", probability: 1 } } };
    });
    await provider.evaluate(gatewayNoulRequest({ r1: { type: "noul", instructions: "i" } }), {
      signal: new AbortController().signal,
    });
    expect(questions).toEqual({ r1: { type: "boolean", instructions: "i" } });
  });

  it("preserves question order and ids", async () => {
    let keys: string[] = [];
    const provider = providerWith(async (call) => {
      keys = Object.keys(call.questions);
      return {
        answers: {
          b: { type: "boolean", probability: 1 },
          a: { type: "boolean", probability: 1 },
          c: { type: "boolean", probability: 1 },
        },
      };
    });
    await provider.evaluate(
      gatewayNoulRequest({
        b: { type: "noul", instructions: "b" },
        a: { type: "noul", instructions: "a" },
        c: { type: "noul", instructions: "c" },
      }),
      { signal: new AbortController().signal },
    );
    expect(keys).toEqual(["b", "a", "c"]);
  });

  it("maps a boolean answer to a noul answer", async () => {
    const provider = providerWith(async () => ({
      answers: { r1: { type: "boolean", probability: 0.83 } },
      usage: { inputTokens: 120, outputTokens: 4 },
      response: { modelId: "typesafe-ai/jev" },
    }));
    const response = await provider.evaluate(noul, { signal: new AbortController().signal });
    expect(response).toEqual({
      model: "typesafe-ai/jev",
      answers: { r1: { type: "noul", noul: 0.83 } },
      usage: { inputTokens: 120, outputTokens: 4 },
    });
  });

  it("omits usage when a token count is missing", async () => {
    const provider = providerWith(async () => ({
      answers: { r1: { type: "boolean", probability: 0.5 } },
      usage: { inputTokens: 10 },
    }));
    const response = await provider.evaluate(noul, { signal: new AbortController().signal });
    expect("usage" in response).toBe(false);
  });

  it("falls back to the default model id", async () => {
    const provider = providerWith(async () => ({
      answers: { r1: { type: "boolean", probability: 0.5 } },
    }));
    const response = await provider.evaluate(noul, { signal: new AbortController().signal });
    expect(response.model).toBe("typesafe-ai/jev");
  });

  it("forwards the signal and maxRetries", async () => {
    const controller = new AbortController();
    let abortSignal: AbortSignal | undefined;
    let evaluateArgs: { maxRetries?: number; abortSignal?: AbortSignal } | undefined;
    const model = gatewayMockModel(async (call) => {
      abortSignal = call.abortSignal;
      return { answers: { r1: { type: "boolean", probability: 1 } } };
    });
    const provider = gatewayProvider(
      { model, maxRetries: 0 },
      {
        importModule: async (specifier) => {
          const loaded = await import(specifier);
          if (specifier !== "ai") {
            return loaded;
          }
          const ai = loaded as {
            experimental_evaluate: (args: {
              maxRetries?: number;
              abortSignal?: AbortSignal;
            }) => Promise<unknown>;
          };
          return {
            ...loaded,
            experimental_evaluate: async (args: {
              maxRetries?: number;
              abortSignal?: AbortSignal;
            }) => {
              evaluateArgs = args;
              return ai.experimental_evaluate(args);
            },
          };
        },
      },
    );
    await provider.evaluate(noul, { signal: controller.signal });
    expect(abortSignal).toBe(controller.signal);
    expect(evaluateArgs?.maxRetries).toBe(0);
    expect(evaluateArgs?.abortSignal).toBe(controller.signal);
  });

  it("does not retry on its own", async () => {
    let calls = 0;
    const provider = providerWith(async () => {
      calls += 1;
      throw new APICallError({
        message: "rate limited",
        url: "https://example.test",
        requestBodyValues: {},
        statusCode: 429,
        isRetryable: true,
      });
    });
    const error = await provider
      .evaluate(noul, { signal: new AbortController().signal })
      .catch((caught: unknown) => caught);
    expect(calls).toBe(1);
    expect(error).toMatchObject({ code: "http", status: 429, retryable: true });
  });

  it("treats a missing answer as malformed", async () => {
    const provider = providerWith(async () => ({
      answers: { r1: { type: "boolean", probability: 1 } },
    }));
    const error = await provider
      .evaluate(
        gatewayNoulRequest({
          r1: { type: "noul", instructions: "a" },
          r2: { type: "noul", instructions: "b" },
        }),
        { signal: new AbortController().signal },
      )
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "malformed_response" });
  });

  it("treats a type mismatch as malformed", async () => {
    const provider = providerWith(async () => ({
      answers: { r1: { type: "choice", choice: "a" } },
    }));
    const error = await provider
      .evaluate(noul, { signal: new AbortController().signal })
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "malformed_response" });
  });

  it("treats an out-of-range probability as malformed", async () => {
    for (const probability of [1.2, Number.NaN]) {
      const provider = providerWith(async () => ({
        answers: { r1: { type: "boolean", probability } },
      }));
      const error = await provider
        .evaluate(noul, { signal: new AbortController().signal })
        .catch((caught: unknown) => caught);
      expect(error).toMatchObject({ code: "malformed_response" });
    }
  });
});

describe("gateway error mapping", () => {
  it("maps APICallError with a status", async () => {
    const first = new APICallError({
      message: "unauthorized",
      url: "https://example.test",
      requestBodyValues: {},
      statusCode: 401,
      isRetryable: false,
    });
    const unauthorized = await providerWith(async () => {
      throw first;
    })
      .evaluate(noul, { signal: new AbortController().signal })
      .catch((caught: unknown) => caught);
    expect(unauthorized).toMatchObject({ code: "http", status: 401, retryable: false });
    expect((unauthorized as EDcheckProviderError).cause).toBe(first);

    const second = new APICallError({
      message: "down",
      url: "https://example.test",
      requestBodyValues: {},
      statusCode: 503,
      isRetryable: true,
    });
    const unavailable = await providerWith(async () => {
      throw second;
    })
      .evaluate(noul, { signal: new AbortController().signal })
      .catch((caught: unknown) => caught);
    expect(unavailable).toMatchObject({ code: "http", status: 503, retryable: true });
  });

  it("maps APICallError without a status to network", async () => {
    const provider = providerWith(async () => {
      throw new APICallError({
        message: "offline",
        url: "https://example.test",
        requestBodyValues: {},
      });
    });
    const error = await provider
      .evaluate(noul, { signal: new AbortController().signal })
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "network", retryable: false });
  });

  it("maps InvalidResponseDataError to malformed_response", async () => {
    const provider = providerWith(async () => {
      throw new InvalidResponseDataError({ data: {} });
    });
    const error = await provider
      .evaluate(noul, { signal: new AbortController().signal })
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "malformed_response" });
  });

  it("maps an unsupported question type to a config error", async () => {
    const provider = providerWith(async () => ({ answers: {} }), {
      supportedQuestionTypes: ["choice"],
    });
    const error = await provider
      .evaluate(noul, { signal: new AbortController().signal })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EDcheckConfigError);
    expect(error).toMatchObject({ code: "unsupported_question_type" });
  });

  it("maps InvalidArgumentError to invalid_provider_options", async () => {
    const provider = providerWith(async () => {
      throw new InvalidArgumentError({
        parameter: "state",
        value: undefined,
        message: "bad",
      });
    });
    const error = await provider
      .evaluate(noul, { signal: new AbortController().signal })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EDcheckConfigError);
    expect(error).toMatchObject({ code: "invalid_provider_options" });
  });

  it("maps an unknown SDK error to sdk", async () => {
    const cause = new Error("boom");
    const provider = providerWith(async () => {
      throw cause;
    });
    const error = await provider
      .evaluate(noul, { signal: new AbortController().signal })
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "sdk", retryable: false });
    expect((error as EDcheckProviderError).cause).toBe(cause);
  });

  it("propagates abort", async () => {
    const controller = new AbortController();
    const reason = new Error("stop");
    const provider = providerWith(async ({ abortSignal }) => {
      await new Promise<void>((_resolve, reject) => {
        abortSignal?.addEventListener("abort", () => reject(abortSignal.reason));
      });
      return { answers: { r1: { type: "boolean", probability: 1 } } };
    });
    const pending = provider.evaluate(noul, { signal: controller.signal });
    setTimeout(() => controller.abort(reason), 10);
    await expect(pending).rejects.toBe(reason);
  });

  it("lets abort win over error mapping", async () => {
    const controller = new AbortController();
    const reason = new Error("stop");
    controller.abort(reason);
    const provider = providerWith(async () => {
      throw new APICallError({
        message: "late",
        url: "https://example.test",
        requestBodyValues: {},
        statusCode: 500,
      });
    });
    await expect(provider.evaluate(noul, { signal: controller.signal })).rejects.toBe(reason);
  });
});
