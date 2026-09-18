import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createEDcheck,
  EDcheckAbortError,
  EDcheckConfigError,
  EDcheckProviderError,
  mockProvider,
  semantic,
  type EDcheckHooks,
  type ProviderErrorEvent,
  type ProviderRequestEvent,
  type ProviderResponseEvent,
  type SemanticProvider,
  type SemanticRequest,
  type SemanticResponse,
} from "edcheck";

const schema = z.object({ fullName: z.string(), bio: z.string() });
const rules = {
  fullName: semantic("A plausible full name for a real person"),
  bio: semantic("Meaningful professional biography"),
};
const data = { fullName: "Ana Pérez", bio: "Engineer" };
const uuid = /^[0-9a-f-]{36}$/;

function collectHooks(): {
  requestEvents: ProviderRequestEvent[];
  responseEvents: ProviderResponseEvent[];
  errorEvents: ProviderErrorEvent[];
  hooks: EDcheckHooks;
} {
  const requestEvents: ProviderRequestEvent[] = [];
  const responseEvents: ProviderResponseEvent[] = [];
  const errorEvents: ProviderErrorEvent[] = [];
  return {
    requestEvents,
    responseEvents,
    errorEvents,
    hooks: {
      onRequest: (event) => {
        requestEvents.push(event);
      },
      onResponse: (event) => {
        responseEvents.push(event);
      },
      onError: (event) => {
        errorEvents.push(event);
      },
    },
  };
}

function byIndex<T extends { requestIndex: number }>(events: T[]): Record<number, T> {
  return Object.fromEntries(events.map((event) => [event.requestIndex, event]));
}

function stripVolatile(event: ProviderErrorEvent): Record<string, unknown> {
  const { durationMs, timestamp, parseId, requestId, ...rest } = event;
  void durationMs;
  void timestamp;
  void parseId;
  void requestId;
  return rest;
}

describe("hook registration", () => {
  it("treats omitted hooks and empty hooks as optional", async () => {
    const omitted = createEDcheck({ provider: mockProvider() });
    const empty = createEDcheck({ provider: mockProvider(), hooks: {} });
    expect(omitted).toBeDefined();
    expect(empty).toBeDefined();
    const first = await omitted.define(schema, { rules }).safeParse(data);
    const second = await empty.define(schema, { rules }).safeParse(data);
    expect(first).toEqual(second);
  });

  it("accepts a partial registration", async () => {
    const responseEvents: ProviderResponseEvent[] = [];
    const result = await createEDcheck({
      provider: mockProvider(),
      hooks: {
        onResponse: (event) => {
          responseEvents.push(event);
        },
      },
    })
      .define(schema, { rules: { fullName: rules.fullName } })
      .safeParse({ fullName: "Ana Pérez", bio: "Engineer" });
    expect(result.success).toBe(true);
    expect(responseEvents).toHaveLength(1);
  });

  it("rejects a non-function hook", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider(), hooks: { onRequest: "log" as never } }),
    ).toThrow(EDcheckConfigError);
    try {
      createEDcheck({ provider: mockProvider(), hooks: { onRequest: "log" as never } });
    } catch (error) {
      expect(error).toMatchObject({ code: "invalid_option" });
      expect((error as Error).message).toContain("onRequest");
    }
  });

  it("rejects an unknown hook key", () => {
    expect(() =>
      createEDcheck({
        provider: mockProvider(),
        hooks: { onFinish: () => undefined } as never,
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_option" }));
    try {
      createEDcheck({
        provider: mockProvider(),
        hooks: { onFinish: () => undefined } as never,
      });
    } catch (error) {
      expect((error as Error).message).toContain("onFinish");
    }
  });

  it("rejects null hooks", () => {
    expect(() => createEDcheck({ provider: mockProvider(), hooks: null as never })).toThrowError(
      expect.objectContaining({ code: "invalid_option" }),
    );
  });
});

describe("request events", () => {
  it("emits one request event per parse with uniform context", async () => {
    const collected = collectHooks();
    const provider = mockProvider();
    await createEDcheck({ provider, hooks: collected.hooks })
      .define(schema, { rules })
      .safeParse(data);
    expect(collected.requestEvents).toHaveLength(1);
    expect(collected.requestEvents[0]).toMatchObject({
      requestIndex: 0,
      requestCount: 1,
      entry: "object",
    });
    expect(collected.requestEvents[0]?.ruleIds).toEqual(
      Object.keys(provider.calls[0]?.questions ?? {}),
    );
  });

  it("passes the compiled request by identity", async () => {
    const collected = collectHooks();
    const provider = mockProvider();
    await createEDcheck({ provider, hooks: collected.hooks })
      .define(schema, { rules })
      .safeParse(data);
    expect(collected.requestEvents[0]?.request).toBe(provider.calls[0]);
  });

  it("fires before the provider is called", async () => {
    const collected = collectHooks();
    let seen = 0;
    const provider: SemanticProvider = {
      name: "probe",
      async evaluate() {
        seen = collected.requestEvents.length;
        return {
          model: "probe",
          answers: {
            fullName: { type: "noul", noul: 0.9 },
            bio: { type: "noul", noul: 0.9 },
          },
        };
      },
    };
    await createEDcheck({ provider, hooks: collected.hooks })
      .define(schema, { rules })
      .safeParse(data);
    expect(seen).toBe(1);
  });

  it("includes the provider name and UUID-shaped ids", async () => {
    const collected = collectHooks();
    const started = Date.now();
    await createEDcheck({ provider: mockProvider(), hooks: collected.hooks })
      .define(schema, { rules })
      .safeParse(data);
    const ended = Date.now();
    const event = collected.requestEvents[0];
    expect(event?.provider).toBe("mock");
    expect(event?.parseId).toMatch(uuid);
    expect(event?.requestId).toMatch(uuid);
    expect(event?.timestamp).toBeGreaterThanOrEqual(started);
    expect(event?.timestamp).toBeLessThanOrEqual(ended);
  });

  it("gives distinct parses distinct parseIds", async () => {
    const collected = collectHooks();
    const bound = createEDcheck({ provider: mockProvider(), hooks: collected.hooks }).define(
      schema,
      { rules },
    );
    await bound.safeParse(data);
    await bound.safeParse(data);
    expect(collected.requestEvents).toHaveLength(2);
    expect(collected.requestEvents[0]?.parseId).not.toBe(collected.requestEvents[1]?.parseId);
    expect(collected.requestEvents[0]?.requestId).not.toBe(collected.requestEvents[1]?.requestId);
  });

  it("still fires onRequest when evaluate throws synchronously", async () => {
    const collected = collectHooks();
    const provider: SemanticProvider = {
      name: "sync-throw",
      evaluate(): Promise<SemanticResponse> {
        throw new Error("sync");
      },
    };
    await expect(
      createEDcheck({ provider, hooks: collected.hooks }).define(schema, { rules }).safeParse(data),
    ).rejects.toThrow("sync");
    expect(collected.requestEvents).toHaveLength(1);
    expect(collected.errorEvents).toHaveLength(1);
  });
});

describe("response events", () => {
  it("reports model, answers and outcomes", async () => {
    const collected = collectHooks();
    await createEDcheck({
      provider: mockProvider({ answers: { fullName: 0.95, bio: 0.6 }, model: "mock" }),
      hooks: collected.hooks,
    })
      .define(schema, { rules })
      .safeParse(data);
    expect(collected.responseEvents).toHaveLength(1);
    const event = collected.responseEvents[0];
    expect(event?.response.model).toBe("mock");
    expect(event?.response.answers.fullName).toMatchObject({ type: "noul", noul: 0.95 });
    expect(event?.outcomes).toEqual({ fullName: "pass", bio: "warning" });
    expect(event?.parseId).toBe(collected.requestEvents[0]?.parseId);
    expect(event?.requestId).toBe(collected.requestEvents[0]?.requestId);
  });

  it("reports a fail outcome", async () => {
    const collected = collectHooks();
    const result = await createEDcheck({
      provider: mockProvider({ answers: { fullName: 0.1 } }),
      hooks: collected.hooks,
    })
      .define(schema, { rules: { fullName: rules.fullName } })
      .safeParse({ fullName: "xx", bio: "Engineer" });
    expect(collected.responseEvents[0]?.outcomes.fullName).toBe("fail");
    expect(result.issues.filter((issue) => issue.severity === "error")).toHaveLength(1);
  });

  it("carries usage from the provider response", async () => {
    const collected = collectHooks();
    const provider: SemanticProvider = {
      name: "usage",
      async evaluate() {
        return {
          model: "mock",
          answers: { fullName: { type: "noul", noul: 0.9 } },
          usage: { inputTokens: 120, outputTokens: 8 },
        };
      },
    };
    await createEDcheck({ provider, hooks: collected.hooks })
      .define(schema, { rules: { fullName: rules.fullName } })
      .safeParse({ fullName: "Ana Pérez", bio: "Engineer" });
    expect(collected.responseEvents[0]?.response.usage).toEqual({
      inputTokens: 120,
      outputTokens: 8,
    });
  });

  it("reflects provider latency in durationMs", async () => {
    const collected = collectHooks();
    await createEDcheck({
      provider: mockProvider({ delayMs: 40 }),
      hooks: collected.hooks,
    })
      .define(schema, { rules })
      .safeParse(data);
    expect(collected.responseEvents[0]?.durationMs).toBeGreaterThanOrEqual(30);
    expect(Number.isFinite(collected.responseEvents[0]?.durationMs)).toBe(true);
  });

  it("fires before the parse promise settles", async () => {
    const collected = collectHooks();
    await createEDcheck({ provider: mockProvider(), hooks: collected.hooks })
      .define(schema, { rules })
      .safeParse(data);
    expect(collected.responseEvents).toHaveLength(1);
  });

  it("emits exactly one terminal event per request", async () => {
    const collected = collectHooks();
    await createEDcheck({ provider: mockProvider(), hooks: collected.hooks })
      .define(schema, { rules })
      .safeParse(data);
    expect(collected.responseEvents).toHaveLength(1);
    expect(collected.errorEvents).toHaveLength(0);
  });
});

describe("error events", () => {
  it("maps a provider error", async () => {
    const collected = collectHooks();
    const error = new EDcheckProviderError("http", { status: 503 });
    const result = await createEDcheck({
      provider: mockProvider({ error }),
      policy: "open",
      hooks: collected.hooks,
    })
      .define(schema, { rules })
      .safeParse(data);
    expect(collected.errorEvents).toHaveLength(1);
    expect(collected.errorEvents[0]?.kind).toBe("provider");
    expect(collected.errorEvents[0]?.error).toBe(error);
    expect(collected.errorEvents[0]?.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.issues.every((issue) => issue.code === "semantic_unavailable")).toBe(true);
    expect(result.issues.every((issue) => issue.severity === "warning")).toBe(true);
  });

  it("maps a timeout to a provider error", async () => {
    const collected = collectHooks();
    const result = await createEDcheck({
      provider: mockProvider({ delayMs: 500 }),
      timeoutMs: 20,
      hooks: collected.hooks,
    })
      .define(schema, { rules })
      .safeParse(data);
    expect(collected.errorEvents).toHaveLength(1);
    expect(collected.errorEvents[0]?.kind).toBe("provider");
    expect(collected.errorEvents[0]?.error).toMatchObject({ code: "timeout" });
    expect(collected.responseEvents).toHaveLength(0);
    expect(result.issues.every((issue) => issue.code === "semantic_unavailable")).toBe(true);
  });

  it("maps a malformed response to a provider error", async () => {
    const collected = collectHooks();
    await createEDcheck({
      provider: mockProvider({ answers: () => 2 }),
      hooks: collected.hooks,
    })
      .define(schema, { rules })
      .safeParse(data);
    expect(collected.errorEvents).toHaveLength(1);
    expect(collected.errorEvents[0]?.kind).toBe("provider");
    expect(collected.errorEvents[0]?.error).toMatchObject({ code: "malformed_response" });
  });

  it("maps a caller abort and shares the rejection instance", async () => {
    const collected = collectHooks();
    const controller = new AbortController();
    const pending = createEDcheck({
      provider: mockProvider({ delayMs: 200 }),
      hooks: collected.hooks,
    })
      .define(schema, { rules })
      .safeParse(data, { signal: controller.signal });
    setTimeout(() => controller.abort(new Error("nav")), 20);
    const rejected = await pending.catch((error: unknown) => error);
    expect(rejected).toBeInstanceOf(EDcheckAbortError);
    expect(collected.errorEvents).toHaveLength(1);
    expect(collected.errorEvents[0]?.kind).toBe("abort");
    expect(collected.errorEvents[0]?.error).toBe(rejected);
    expect((rejected as EDcheckAbortError).cause).toMatchObject({ message: "nav" });
  });

  it("maps an unexpected error and rethrows it", async () => {
    const collected = collectHooks();
    const boom = new Error("boom");
    const provider: SemanticProvider = {
      name: "boom",
      async evaluate() {
        throw boom;
      },
    };
    const rejected = await createEDcheck({ provider, hooks: collected.hooks })
      .define(schema, { rules })
      .safeParse(data)
      .catch((error: unknown) => error);
    expect(rejected).toBe(boom);
    expect(collected.errorEvents).toHaveLength(1);
    expect(collected.errorEvents[0]?.kind).toBe("unexpected");
    expect(collected.errorEvents[0]?.error).toBe(boom);
  });

  it("fires the error event before the rejection is observed", async () => {
    const collected = collectHooks();
    const provider: SemanticProvider = {
      name: "boom",
      async evaluate() {
        throw new Error("boom");
      },
    };
    await createEDcheck({ provider, hooks: collected.hooks })
      .define(schema, { rules })
      .safeParse(data)
      .catch(() => undefined);
    expect(collected.errorEvents).toHaveLength(1);
  });

  it("keeps the error event shape under closed policy", async () => {
    const error = new EDcheckProviderError("http", { status: 503 });
    const open = collectHooks();
    const closed = collectHooks();
    const openResult = await createEDcheck({
      provider: mockProvider({ error }),
      policy: "open",
      hooks: open.hooks,
    })
      .define(schema, { rules })
      .safeParse(data);
    const closedResult = await createEDcheck({
      provider: mockProvider({ error }),
      policy: "closed",
      hooks: closed.hooks,
    })
      .define(schema, { rules })
      .safeParse(data);
    expect(stripVolatile(open.errorEvents[0] as ProviderErrorEvent)).toEqual(
      stripVolatile(closed.errorEvents[0] as ProviderErrorEvent),
    );
    expect(closedResult.issues.every((issue) => issue.severity === "error")).toBe(true);
    expect(openResult.issues.every((issue) => issue.severity === "warning")).toBe(true);
  });
});

describe("zero-request parses fire nothing", () => {
  it("fires nothing on a root shape failure", async () => {
    const collected = collectHooks();
    const result = await createEDcheck({ provider: mockProvider(), hooks: collected.hooks })
      .define(schema, { rules })
      .safeParse(42);
    expect(collected.requestEvents).toHaveLength(0);
    expect(collected.responseEvents).toHaveLength(0);
    expect(collected.errorEvents).toHaveLength(0);
    expect(result.issues.every((issue) => issue.code !== "semantic_unavailable")).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("fires nothing when every rule is excluded by shape", async () => {
    const collected = collectHooks();
    const provider = mockProvider();
    await createEDcheck({ provider, hooks: collected.hooks })
      .define(schema, { rules: { fullName: rules.fullName } })
      .safeParse({ fullName: 7, bio: "Engineer" });
    expect(provider.calls).toHaveLength(0);
    expect(collected.requestEvents).toHaveLength(0);
  });

  it("fires nothing for a nullish-only value", async () => {
    const collected = collectHooks();
    const provider = mockProvider();
    await createEDcheck({ provider, hooks: collected.hooks })
      .define(z.object({ nickname: z.string().optional() }), {
        rules: { nickname: semantic("A nickname") },
      })
      .safeParse({});
    expect(provider.calls).toHaveLength(0);
    expect(collected.requestEvents).toHaveLength(0);
  });

  it("fires nothing for a pre-aborted signal", async () => {
    const collected = collectHooks();
    const controller = new AbortController();
    controller.abort(new Error("already"));
    await expect(
      createEDcheck({ provider: mockProvider(), hooks: collected.hooks })
        .define(schema, { rules })
        .safeParse(data, { signal: controller.signal }),
    ).rejects.toBeInstanceOf(EDcheckAbortError);
    expect(collected.requestEvents).toHaveLength(0);
    expect(collected.errorEvents).toHaveLength(0);
  });
});

describe("hook isolation", () => {
  it("does not change the result when onRequest throws", async () => {
    const baseline = await createEDcheck({ provider: mockProvider() })
      .define(schema, { rules })
      .safeParse(data);
    const provider = mockProvider();
    const result = await createEDcheck({
      provider,
      hooks: {
        onRequest: () => {
          throw new Error("hook");
        },
      },
    })
      .define(schema, { rules })
      .safeParse(data);
    expect(result).toEqual(baseline);
    expect(provider.calls).toHaveLength(1);
  });

  it("does not change the result when onResponse throws", async () => {
    const baseline = await createEDcheck({ provider: mockProvider() })
      .define(schema, { rules })
      .safeParse(data);
    const result = await createEDcheck({
      provider: mockProvider(),
      hooks: {
        onResponse: () => {
          throw new Error("hook");
        },
      },
    })
      .define(schema, { rules })
      .safeParse(data);
    expect(result).toEqual(baseline);
  });

  it("does not change the result when onError throws", async () => {
    const error = new EDcheckProviderError("http", { status: 503 });
    const baseline = await createEDcheck({ provider: mockProvider({ error }), policy: "open" })
      .define(schema, { rules })
      .safeParse(data);
    const result = await createEDcheck({
      provider: mockProvider({ error }),
      policy: "open",
      hooks: {
        onError: () => {
          throw new Error("hook");
        },
      },
    })
      .define(schema, { rules })
      .safeParse(data);
    expect(result).toEqual(baseline);
    expect(result.issues.every((issue) => issue.code === "semantic_unavailable")).toBe(true);
  });

  it("does not raise unhandledRejection for a rejected hook promise", async () => {
    const rejections: unknown[] = [];
    const listener = (reason: unknown) => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", listener);
    const result = await createEDcheck({
      provider: mockProvider(),
      hooks: {
        onResponse: async () => {
          throw new Error("late");
        },
      },
    })
      .define(schema, { rules })
      .safeParse(data);
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    process.off("unhandledRejection", listener);
    expect(rejections).toEqual([]);
    expect(result.success).toBe(true);
  });

  it("does not wait for a never-settling hook", async () => {
    const started = Date.now();
    await createEDcheck({
      provider: mockProvider(),
      hooks: { onResponse: () => new Promise(() => {}) },
    })
      .define(schema, { rules })
      .safeParse(data);
    expect(Date.now() - started).toBeLessThan(100);
  });

  it("ignores a hook return value", async () => {
    const provider = mockProvider();
    const result = await createEDcheck({
      provider,
      hooks: { onRequest: () => ({ cancel: true }) as never },
    })
      .define(schema, { rules })
      .safeParse(data);
    expect(provider.calls).toHaveLength(1);
    expect(result.success).toBe(true);
  });

  it("cannot swallow a caller abort", async () => {
    const controller = new AbortController();
    const pending = createEDcheck({
      provider: mockProvider({ delayMs: 200 }),
      hooks: {
        onError: () => {
          throw new Error("hook");
        },
      },
    })
      .define(schema, { rules })
      .safeParse(data, { signal: controller.signal });
    setTimeout(() => controller.abort(new Error("nav")), 20);
    await expect(pending).rejects.toBeInstanceOf(EDcheckAbortError);
  });
});

describe("multi-group parses", () => {
  it("emits one request event per group", async () => {
    const collected = collectHooks();
    await createEDcheck({ provider: mockProvider(), hooks: collected.hooks })
      .define(schema, {
        rules: {
          fullName: semantic({ intent: "A name", context: { audience: "a" } }),
          bio: semantic({ intent: "A bio", context: { audience: "b" } }),
        },
      })
      .safeParse(data);
    expect(collected.requestEvents).toHaveLength(2);
    expect(new Set(collected.requestEvents.map((event) => event.parseId)).size).toBe(1);
    expect(collected.requestEvents.every((event) => event.requestCount === 2)).toBe(true);
    const indexed = byIndex(collected.requestEvents);
    expect(indexed[0]?.ruleIds).toEqual(["fullName"]);
    expect(indexed[1]?.ruleIds).toEqual(["bio"]);
    expect(indexed[0]?.requestId).not.toBe(indexed[1]?.requestId);
  });

  it("emits onResponse for the succeeding group and onError for the failing one", async () => {
    const collected = collectHooks();
    const provider: SemanticProvider = {
      name: "split",
      async evaluate(request: SemanticRequest) {
        const context = request.state.context as { audience?: string } | undefined;
        if (context?.audience === "b") {
          throw new EDcheckProviderError("http", { status: 503 });
        }
        const answers: SemanticResponse["answers"] = {};
        for (const id of Object.keys(request.questions)) {
          answers[id] = { type: "noul", noul: 0.95 };
        }
        return { model: "split", answers };
      },
    };
    const result = await createEDcheck({ provider, policy: "open", hooks: collected.hooks })
      .define(schema, {
        rules: {
          fullName: semantic({ intent: "A name", context: { audience: "a" } }),
          bio: semantic({ intent: "A bio", context: { audience: "b" } }),
        },
      })
      .safeParse(data);
    expect(collected.responseEvents).toHaveLength(1);
    expect(collected.responseEvents[0]?.requestIndex).toBe(0);
    expect(collected.errorEvents).toHaveLength(1);
    expect(collected.errorEvents[0]?.requestIndex).toBe(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      code: "semantic_unavailable",
      path: ["bio"],
    });
  });
});
