import { describe, expect, it } from "vitest";

import { invokeHook } from "../../src/api/invoke-hook.ts";

describe("invokeHook", () => {
  it("is a no-op when the hook is undefined", () => {
    expect(() => invokeHook(undefined, { n: 1 })).not.toThrow();
  });

  it("swallows a synchronous throw", () => {
    expect(() =>
      invokeHook(() => {
        throw new Error("hook");
      }, { n: 1 }),
    ).not.toThrow();
  });

  it("handles a rejected promise without an unhandledRejection", async () => {
    const rejections: unknown[] = [];
    const listener = (reason: unknown) => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", listener);
    invokeHook(async () => {
      throw new Error("late");
    }, { n: 1 });
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    process.off("unhandledRejection", listener);
    expect(rejections).toEqual([]);
  });

  it("ignores the return value", () => {
    expect(() => invokeHook(() => ({ cancel: true }) as never, { n: 1 })).not.toThrow();
  });

  it("passes the event by reference", () => {
    const event = { n: 1 };
    let received: { n: number } | undefined;
    invokeHook((value) => {
      received = value;
    }, event);
    expect(received).toBe(event);
  });
});
