import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createEDcheck,
  EDcheckAbortError,
  mockProvider,
  semantic,
} from "edcheck";

const schema = z.object({ fullName: z.string() });
const rules = { fullName: semantic("A plausible full name for a real person") };
const data = { fullName: "Ana Pérez" };

describe("cancellation and timeout", () => {
  it("rejects a pre-aborted signal without calling the provider", async () => {
    const provider = mockProvider();
    const controller = new AbortController();
    controller.abort(new Error("already"));
    await expect(
      createEDcheck({ provider }).define(schema, { rules }).safeParse(data, {
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(EDcheckAbortError);
    expect(provider.calls).toHaveLength(0);
  });

  it("rejects an in-flight abort without an unhandled rejection", async () => {
    const provider = mockProvider({ delayMs: 200 });
    const controller = new AbortController();
    let unhandled: unknown;
    const onUnhandled = (reason: unknown): void => {
      unhandled = reason;
    };
    process.once("unhandledRejection", onUnhandled);
    const pending = createEDcheck({ provider })
      .define(schema, { rules })
      .safeParse(data, { signal: controller.signal });
    setTimeout(() => controller.abort(), 20);
    await expect(pending).rejects.toBeInstanceOf(EDcheckAbortError);
    await new Promise((resolve) => setTimeout(resolve, 30));
    process.removeListener("unhandledRejection", onUnhandled);
    expect(unhandled).toBeUndefined();
  });

  it("preserves the abort reason", async () => {
    const provider = mockProvider({ delayMs: 100 });
    const controller = new AbortController();
    const reason = new Error("user navigated");
    const pending = createEDcheck({ provider })
      .define(schema, { rules })
      .safeParse(data, { signal: controller.signal });
    controller.abort(reason);
    const error = await pending.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EDcheckAbortError);
    expect((error as EDcheckAbortError).cause).toBe(reason);
  });

  it("treats timeout as an unavailable warning under open policy", async () => {
    const provider = mockProvider({ delayMs: 500 });
    const result = await createEDcheck({ provider, timeoutMs: 20 })
      .define(schema, { rules })
      .safeParse(data);
    expect(result.issues.every((issue) => issue.code === "semantic_unavailable")).toBe(true);
    expect(result.issues[0]?.severity).toBe("warning");
  });

  it("lets a per-call timeout override the instance timeout", async () => {
    const provider = mockProvider({ delayMs: 200 });
    const started = Date.now();
    const result = await createEDcheck({ provider, timeoutMs: 10000 })
      .define(schema, { rules })
      .safeParse(data, { timeoutMs: 20 });
    expect(Date.now() - started).toBeLessThan(200);
    expect(result.issues[0]?.code).toBe("semantic_unavailable");
  });

  it("leaves a live caller signal untouched when the provider is fast", async () => {
    const provider = mockProvider();
    const controller = new AbortController();
    const result = await createEDcheck({ provider })
      .define(schema, { rules })
      .safeParse(data, { signal: controller.signal });
    expect(result.success).toBe(true);
    expect(controller.signal.aborted).toBe(false);
  });

  it("aborts the provider signal at timeout", async () => {
    const provider = mockProvider({ delayMs: 500 });
    const bound = createEDcheck({ provider, timeoutMs: 30 }).define(schema, { rules });
    const result = await bound.safeParse(data);
    expect(result.issues[0]?.code).toBe("semantic_unavailable");
  });

  it("uses error severity for timeout under closed policy", async () => {
    const provider = mockProvider({ delayMs: 500 });
    const result = await createEDcheck({ provider, timeoutMs: 30, policy: "closed" })
      .define(schema, { rules })
      .safeParse(data);
    expect(result.issues[0]?.severity).toBe("error");
    expect(result.success).toBe(false);
  });

  it("treats a caller abort during the timeout window as an abort", async () => {
    const provider = mockProvider({ delayMs: 500 });
    const controller = new AbortController();
    const pending = createEDcheck({ provider, timeoutMs: 300 })
      .define(schema, { rules })
      .safeParse(data, { signal: controller.signal });
    setTimeout(() => controller.abort(new Error("navigated")), 20);
    await expect(pending).rejects.toBeInstanceOf(EDcheckAbortError);
  });
});
