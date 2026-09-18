import { describe, expect, it } from "vitest";
import { z } from "zod";
import { APICallError } from "ai";

import {
  createEDcheck,
  EDcheckAbortError,
  gatewayProvider,
  semantic,
} from "edcheck";

import { gatewayMockModel } from "../helpers/gateway-mock-model.ts";

const schema = z.object({ fullName: z.string(), bio: z.string() });
const rules = {
  fullName: semantic("A plausible full name for a real person"),
  bio: semantic("Meaningful professional biography"),
};
const data = { fullName: "Ana Pérez", bio: "Engineer" };

function failingModel() {
  return gatewayMockModel(async () => {
    throw new APICallError({
      message: "down",
      url: "https://example.test",
      requestBodyValues: {},
      statusCode: 503,
      isRetryable: true,
    });
  });
}

function hangingModel() {
  return gatewayMockModel(async ({ abortSignal }) => {
    await new Promise<void>((_resolve, reject) => {
      abortSignal?.addEventListener("abort", () => reject(abortSignal.reason));
    });
    return { answers: {} };
  });
}

describe("gateway policy parity", () => {
  it("keeps success under open", async () => {
    const result = await createEDcheck({
      provider: gatewayProvider({ model: failingModel(), maxRetries: 0 }),
      policy: "open",
    })
      .define(schema, { rules })
      .safeParse(data);
    expect(result.success).toBe(true);
    expect(result.issues).toHaveLength(2);
    expect(result.issues.every((issue) => issue.code === "semantic_unavailable")).toBe(true);
    expect(result.issues.every((issue) => issue.severity === "warning")).toBe(true);
  });

  it("fails under closed", async () => {
    const result = await createEDcheck({
      provider: gatewayProvider({ model: failingModel(), maxRetries: 0 }),
      policy: "closed",
    })
      .define(schema, { rules })
      .safeParse(data);
    expect(result.success).toBe(false);
    expect(result.issues.every((issue) => issue.code === "semantic_unavailable")).toBe(true);
    expect(result.issues.every((issue) => issue.severity === "error")).toBe(true);
  });

  it("maps a timeout to unavailable", async () => {
    const result = await createEDcheck({
      provider: gatewayProvider({ model: hangingModel(), maxRetries: 0 }),
      timeoutMs: 20,
    })
      .define(schema, { rules })
      .safeParse(data);
    expect(result.issues.every((issue) => issue.code === "semantic_unavailable")).toBe(true);
  });

  it("rejects a caller abort without emitting a result", async () => {
    const controller = new AbortController();
    const pending = createEDcheck({
      provider: gatewayProvider({ model: hangingModel(), maxRetries: 0 }),
    })
      .define(schema, { rules })
      .safeParse(data, { signal: controller.signal });
    setTimeout(() => controller.abort(new Error("stop")), 10);
    await expect(pending).rejects.toBeInstanceOf(EDcheckAbortError);
  });

  it("succeeds through the pipeline with a restricted state", async () => {
    let state: unknown;
    const model = gatewayMockModel(async (call) => {
      state = call.state;
      return {
        answers: {
          fullName: { type: "boolean", probability: 0.95 },
        },
      };
    });
    const result = await createEDcheck({
      provider: gatewayProvider({ model, maxRetries: 0 }),
    })
      .define(z.object({ fullName: z.string(), bio: z.string() }), {
        rules: { fullName: semantic("A name") },
      })
      .safeParse({ fullName: "Ana Pérez", bio: "Engineer" });
    expect(result.success).toBe(true);
    expect(result.issues).toEqual([]);
    expect(state).toEqual({ fullName: "Ana Pérez" });
  });
});
