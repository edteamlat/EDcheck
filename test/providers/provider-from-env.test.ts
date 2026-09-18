import { afterEach, describe, expect, it, vi } from "vitest";

import { providerFromEnv } from "edcheck";

import { gatewayNoulRequest } from "../helpers/gateway-noul-request.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("provider selection from environment", () => {
  it("uses TypeSafe when only that key is set", () => {
    const provider = providerFromEnv({ env: { TYPESAFE_API_KEY: "t" } });
    expect(provider.name).toBe("typesafe");
  });

  it("uses Gateway when only that key is set", () => {
    const provider = providerFromEnv({ env: { AI_GATEWAY_API_KEY: "g" } });
    expect(provider.name).toBe("gateway");
  });

  it("defaults to TypeSafe when both keys are set", () => {
    const provider = providerFromEnv({
      env: { TYPESAFE_API_KEY: "t", AI_GATEWAY_API_KEY: "g" },
    });
    expect(provider.name).toBe("typesafe");
  });

  it("prefers Gateway when asked", () => {
    const provider = providerFromEnv({
      env: { TYPESAFE_API_KEY: "t", AI_GATEWAY_API_KEY: "g" },
      prefer: "gateway",
    });
    expect(provider.name).toBe("gateway");
  });

  it("falls back when prefer has no matching key", () => {
    const provider = providerFromEnv({
      env: { TYPESAFE_API_KEY: "t" },
      prefer: "gateway",
    });
    expect(provider.name).toBe("typesafe");
  });

  it("rejects when neither key is set", () => {
    expect(() => providerFromEnv({ env: {} })).toThrowError(
      expect.objectContaining({ code: "missing_api_key" }),
    );
    try {
      providerFromEnv({ env: {} });
    } catch (error) {
      expect((error as Error).message).toContain("TYPESAFE_API_KEY");
      expect((error as Error).message).toContain("AI_GATEWAY_API_KEY");
    }
  });

  it("treats empty strings as unset", () => {
    expect(() =>
      providerFromEnv({ env: { TYPESAFE_API_KEY: "", AI_GATEWAY_API_KEY: "  " } }),
    ).toThrowError(expect.objectContaining({ code: "missing_api_key" }));
  });

  it("forwards the TypeSafe key and options", async () => {
    let authorization = "";
    let model = "";
    const provider = providerFromEnv({
      env: { TYPESAFE_API_KEY: "t" },
      typesafe: {
        model: "jev-1.13",
        fetch: async (_url, init) => {
          authorization = new Headers(init?.headers).get("authorization") ?? "";
          model = (JSON.parse(String(init?.body)) as { model: string }).model;
          return new Response(
            JSON.stringify({
              model: "jev-1.13",
              answers: { r1: { type: "noul", noul: 0.9 } },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        },
      },
    });
    await provider.evaluate(gatewayNoulRequest(), { signal: new AbortController().signal });
    expect(authorization).toBe("Bearer t");
    expect(model).toBe("jev-1.13");
  });

  it("forwards Gateway options", async () => {
    let url = "";
    let authorization = "";
    const provider = providerFromEnv({
      env: { AI_GATEWAY_API_KEY: "g" },
      gateway: {
        baseUrl: "https://gw.local",
        maxRetries: 0,
        fetch: async (input, init) => {
          url = String(input);
          authorization = new Headers(init?.headers).get("authorization") ?? "";
          return new Response("{}", { status: 500 });
        },
      },
    });
    await provider
      .evaluate(gatewayNoulRequest(), { signal: new AbortController().signal })
      .catch(() => undefined);
    expect(url.startsWith("https://gw.local")).toBe(true);
    expect(authorization).toBe("Bearer g");
  });

  it("defaults to process.env", () => {
    vi.stubEnv("TYPESAFE_API_KEY", "t");
    expect(providerFromEnv().name).toBe("typesafe");
  });

  it("rejects an invalid prefer", () => {
    expect(() =>
      providerFromEnv({ env: { TYPESAFE_API_KEY: "t" }, prefer: "other" as never }),
    ).toThrowError(expect.objectContaining({ code: "invalid_option" }));
  });
});
