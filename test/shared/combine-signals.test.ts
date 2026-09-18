import { getEventListeners } from "node:events";

import { describe, expect, it } from "vitest";

import { combineSignals } from "../../src/shared/index.ts";

describe("combineSignals", () => {
  it("aborts the combined signal with the same reason as either input", () => {
    const first = new AbortController();
    const second = new AbortController();
    const { signal, dispose } = combineSignals([first.signal, second.signal]);
    const reason = new Error("from-second");
    second.abort(reason);
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe(reason);
    dispose();
  });

  it("yields an already-aborted combined signal when an input is aborted", () => {
    const controller = new AbortController();
    const reason = new Error("already");
    controller.abort(reason);
    const { signal, dispose } = combineSignals([controller.signal]);
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe(reason);
    dispose();
  });

  it("aborts with a TimeoutError-named reason when timeoutMs elapses", async () => {
    const { signal, dispose } = combineSignals([], { timeoutMs: 15 });
    await new Promise<void>((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      signal.addEventListener("abort", () => resolve(), { once: true });
    });
    expect(signal.aborted).toBe(true);
    expect((signal.reason as { name?: string }).name).toBe("TimeoutError");
    dispose();
  });

  it("removes listeners after settle so repeated calls do not grow", async () => {
    const source = new AbortController();
    for (let index = 0; index < 20; index += 1) {
      const { dispose } = combineSignals([source.signal], { timeoutMs: 1 });
      await new Promise((resolve) => setTimeout(resolve, 5));
      dispose();
    }
    expect(getEventListeners(source.signal, "abort")).toHaveLength(0);
  });
});
