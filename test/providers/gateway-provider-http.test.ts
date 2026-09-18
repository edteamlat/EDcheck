import { describe, expect, it } from "vitest";

import { gatewayProvider } from "edcheck";

import { gatewayNoulRequest } from "../helpers/gateway-noul-request.ts";

describe("string model path", () => {
  it("uses the configured key and base URL", async () => {
    let url = "";
    let authorization = "";
    const provider = gatewayProvider({
      apiKey: "gw-key",
      baseUrl: "https://gw.local/v1",
      maxRetries: 0,
      fetch: async (input, init) => {
        url = String(input);
        authorization = new Headers(init?.headers).get("authorization") ?? "";
        return new Response("{}", { status: 500 });
      },
    });
    const error = await provider
      .evaluate(gatewayNoulRequest(), { signal: new AbortController().signal })
      .catch((caught: unknown) => caught);
    expect(url.startsWith("https://gw.local/v1")).toBe(true);
    expect(authorization).toBe("Bearer gw-key");
    expect(error).toMatchObject({ code: "http", status: 500 });
  });

  it("defaults the model id to typesafe-ai/jev", async () => {
    let modelId = "";
    const provider = gatewayProvider({
      apiKey: "gw-key",
      baseUrl: "https://gw.local/v1",
      maxRetries: 0,
      fetch: async (_input, init) => {
        modelId = new Headers(init?.headers).get("ai-model-id") ?? "";
        return new Response("{}", { status: 500 });
      },
    });
    await provider.evaluate(gatewayNoulRequest(), { signal: new AbortController().signal }).catch(
      () => undefined,
    );
    expect(modelId).toBe("typesafe-ai/jev");
  });
});
