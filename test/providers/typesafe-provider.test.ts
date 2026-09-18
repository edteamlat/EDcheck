import { describe, expect, it } from "vitest";

import { EDcheckConfigError, EDcheckProviderError, typesafeProvider } from "edcheck";

import type { SemanticRequest } from "../../src/providers/types/index.ts";

const request: SemanticRequest = {
  state: { fullName: "Ana" },
  questions: {
    fullName: {
      type: "noul",
      instructions: "Does `fullName` fit the following description? A name",
    },
  },
};

const okBody = {
  model: "jev-1.13",
  answers: { fullName: { type: "noul", noul: 0.42 } },
  usage: { input_tokens: 10, output_tokens: 2 },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("typesafeProvider", () => {
  it("sends the expected request shape", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const provider = typesafeProvider({
      apiKey: "k",
      fetch: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return jsonResponse(200, okBody);
      },
    });
    await provider.evaluate(request, { signal: new AbortController().signal });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(calls[0]?.init.method).toBe("POST");
    const headers = new Headers(calls[0]?.init.headers);
    expect(headers.get("authorization")).toBe("Bearer k");
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      state: request.state,
      model: "jev-latest",
      questions: request.questions,
    });
  });

  it("honours a custom model and baseUrl", async () => {
    let url = "";
    let body = "";
    const provider = typesafeProvider({
      apiKey: "k",
      model: "jev-1.13",
      baseUrl: "https://proxy.local",
      fetch: async (input, init) => {
        url = String(input);
        body = String(init?.body);
        return jsonResponse(200, okBody);
      },
    });
    await provider.evaluate(request, { signal: new AbortController().signal });
    expect(url).toBe("https://proxy.local/v1/systemone");
    expect(JSON.parse(body).model).toBe("jev-1.13");
  });

  it("maps the response and usage fields", async () => {
    const provider = typesafeProvider({
      apiKey: "k",
      fetch: async () => jsonResponse(200, okBody),
    });
    const response = await provider.evaluate(request, { signal: new AbortController().signal });
    expect(response).toEqual({
      model: "jev-1.13",
      answers: { fullName: { type: "noul", noul: 0.42 } },
      usage: { inputTokens: 10, outputTokens: 2 },
    });
  });

  it("rejects a missing apiKey", () => {
    expect(() => typesafeProvider({ apiKey: "" })).toThrow(EDcheckConfigError);
    try {
      typesafeProvider({ apiKey: "" });
    } catch (error) {
      expect((error as EDcheckConfigError).code).toBe("invalid_provider_options");
    }
  });

  it.each([401, 422, 500])("does not retry HTTP %s", async (status) => {
    let calls = 0;
    const provider = typesafeProvider({
      apiKey: "k",
      fetch: async () => {
        calls += 1;
        return jsonResponse(status, {});
      },
    });
    const error = await provider
      .evaluate(request, { signal: new AbortController().signal })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EDcheckProviderError);
    expect(error).toMatchObject({ code: "http", status, retryable: false });
    expect(calls).toBe(1);
  });

  it("retries 429 three times then fails", async () => {
    let calls = 0;
    const provider = typesafeProvider({
      apiKey: "k",
      retries: 2,
      retryDelayMs: 0,
      fetch: async () => {
        calls += 1;
        return jsonResponse(429, {});
      },
    });
    const error = await provider
      .evaluate(request, { signal: new AbortController().signal })
      .catch((caught: unknown) => caught);
    expect(calls).toBe(3);
    expect(error).toMatchObject({ code: "http", status: 429, retryable: true });
  });

  it("retries 529 then succeeds", async () => {
    let calls = 0;
    const provider = typesafeProvider({
      apiKey: "k",
      retryDelayMs: 0,
      fetch: async () => {
        calls += 1;
        if (calls === 1) {
          return jsonResponse(529, {});
        }
        return jsonResponse(200, okBody);
      },
    });
    const response = await provider.evaluate(request, { signal: new AbortController().signal });
    expect(calls).toBe(2);
    expect(response.answers.fullName?.noul).toBe(0.42);
  });

  it("does not retry when retries is 0", async () => {
    let calls = 0;
    const provider = typesafeProvider({
      apiKey: "k",
      retries: 0,
      fetch: async () => {
        calls += 1;
        return jsonResponse(429, {});
      },
    });
    const error = await provider
      .evaluate(request, { signal: new AbortController().signal })
      .catch((caught: unknown) => caught);
    expect(calls).toBe(1);
    expect(error).toMatchObject({ retryable: true });
  });

  it("does not retry a network TypeError", async () => {
    let calls = 0;
    const provider = typesafeProvider({
      apiKey: "k",
      fetch: async () => {
        calls += 1;
        throw new TypeError("fetch failed");
      },
    });
    const error = await provider
      .evaluate(request, { signal: new AbortController().signal })
      .catch((caught: unknown) => caught);
    expect(calls).toBe(1);
    expect(error).toMatchObject({ code: "network", retryable: false });
  });

  it("rejects malformed responses", async () => {
    const cases: Array<() => Response> = [
      () => new Response("not-json", { status: 200 }),
      () => jsonResponse(200, { model: "m" }),
      () => jsonResponse(200, { model: "m", answers: {} }),
      () => jsonResponse(200, { model: "m", answers: { fullName: { type: "noul", noul: 1.5 } } }),
    ];
    for (const make of cases) {
      const provider = typesafeProvider({ apiKey: "k", fetch: async () => make() });
      const error = await provider
        .evaluate(request, { signal: new AbortController().signal })
        .catch((caught: unknown) => caught);
      expect(error).toMatchObject({ code: "malformed_response" });
    }
  });

  it("propagates abort and does not retry", async () => {
    const controller = new AbortController();
    const reason = new Error("stop");
    let calls = 0;
    const provider = typesafeProvider({
      apiKey: "k",
      retries: 2,
      retryDelayMs: 50,
      fetch: async (_url, init) => {
        calls += 1;
        expect(init?.signal).toBeDefined();
        if (calls === 1) {
          return jsonResponse(429, {});
        }
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        });
      },
    });
    const pending = provider.evaluate(request, { signal: controller.signal });
    setTimeout(() => controller.abort(reason), 10);
    await expect(pending).rejects.toBe(reason);
  });
});
