import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createEDcheck, EDcheckConfigError, semantic } from "edcheck";

import { gatewayProvider } from "../../src/providers/gateway/gateway-provider.ts";
import { gatewayMockModel } from "../helpers/gateway-mock-model.ts";
import { gatewayNoulRequest } from "../helpers/gateway-noul-request.ts";

const signal = () => new AbortController().signal;

describe("gateway adapter construction and lazy dependency", () => {
  it("is synchronous and does not import the SDK", () => {
    const requested: string[] = [];
    const provider = gatewayProvider(
      { apiKey: "k" },
      {
        importModule: async (specifier) => {
          requested.push(specifier);
          return import(specifier);
        },
      },
    );
    expect(provider.name).toBe("gateway");
    expect(typeof provider.evaluate).toBe("function");
    expect(requested).toEqual([]);
  });

  it("imports the SDK once on first evaluate", async () => {
    const requested: string[] = [];
    const model = gatewayMockModel(async () => ({
      answers: { r1: { type: "boolean", probability: 0.9 } },
    }));
    const provider = gatewayProvider(
      { model },
      {
        importModule: async (specifier) => {
          requested.push(specifier);
          return import(specifier);
        },
      },
    );
    await provider.evaluate(gatewayNoulRequest(), { signal: signal() });
    await provider.evaluate(gatewayNoulRequest(), { signal: signal() });
    expect(requested.filter((item) => item === "ai")).toEqual(["ai"]);
  });

  it("skips the gateway package for a model instance", async () => {
    const requested: string[] = [];
    const model = gatewayMockModel(async () => ({
      answers: { r1: { type: "boolean", probability: 0.9 } },
    }));
    const provider = gatewayProvider(
      { model },
      {
        importModule: async (specifier) => {
          requested.push(specifier);
          return import(specifier);
        },
      },
    );
    await provider.evaluate(gatewayNoulRequest(), { signal: signal() });
    expect(requested).not.toContain("@ai-sdk/gateway");
  });

  it("rejects a missing ai module with a config error", async () => {
    const provider = gatewayProvider(
      { model: gatewayMockModel(async () => ({ answers: {} })) },
      {
        importModule: async (specifier) => {
          if (specifier === "ai") {
            const error = new Error("Cannot find package 'ai'") as Error & { code: string };
            error.code = "ERR_MODULE_NOT_FOUND";
            throw error;
          }
          return import(specifier);
        },
      },
    );
    const error = await provider
      .evaluate(gatewayNoulRequest(), { signal: signal() })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EDcheckConfigError);
    expect(error).toMatchObject({ code: "missing_peer_dependency" });
    expect((error as Error).message).toContain("ai");
    expect((error as Error).message).toContain("yarn add ai @ai-sdk/gateway");
  });

  it("rejects a missing gateway package with a config error", async () => {
    const provider = gatewayProvider(
      { apiKey: "k", model: "typesafe-ai/jev" },
      {
        importModule: async (specifier) => {
          if (specifier === "@ai-sdk/gateway") {
            const error = new Error("Cannot find package") as Error & { code: string };
            error.code = "ERR_MODULE_NOT_FOUND";
            throw error;
          }
          return import(specifier);
        },
      },
    );
    const error = await provider
      .evaluate(gatewayNoulRequest(), { signal: signal() })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EDcheckConfigError);
    expect(error).toMatchObject({ code: "missing_peer_dependency" });
    expect((error as Error).message).toContain("@ai-sdk/gateway");
  });

  it("does not swallow a missing peer under the open policy", async () => {
    const provider = gatewayProvider(
      { apiKey: "k", model: "typesafe-ai/jev" },
      {
        importModule: async (specifier) => {
          if (specifier === "@ai-sdk/gateway") {
            const error = new Error("missing") as Error & { code: string };
            error.code = "ERR_MODULE_NOT_FOUND";
            throw error;
          }
          return import(specifier);
        },
      },
    );
    await expect(
      createEDcheck({ provider, policy: "open" })
        .define(z.object({ fullName: z.string() }), {
          rules: { fullName: semantic("A name") },
        })
        .safeParse({ fullName: "Ana" }),
    ).rejects.toMatchObject({ code: "missing_peer_dependency" });
  });

  it("rejects an explicitly empty apiKey", () => {
    expect(() => gatewayProvider({ apiKey: "" })).toThrowError(
      expect.objectContaining({ code: "invalid_provider_options" }),
    );
    expect(() => gatewayProvider({ apiKey: "   " })).toThrowError(
      expect.objectContaining({ code: "invalid_provider_options" }),
    );
  });

  it("accepts an omitted apiKey", () => {
    expect(() => gatewayProvider({})).not.toThrow();
    expect(() => gatewayProvider()).not.toThrow();
  });

  it("rejects invalid maxRetries", () => {
    expect(() => gatewayProvider({ maxRetries: -1 })).toThrowError(
      expect.objectContaining({ code: "invalid_provider_options" }),
    );
    expect(() => gatewayProvider({ maxRetries: 1.5 })).toThrowError(
      expect.objectContaining({ code: "invalid_provider_options" }),
    );
  });
});
