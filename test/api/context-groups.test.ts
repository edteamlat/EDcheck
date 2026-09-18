import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createEDcheck,
  EDcheckAbortError,
  EDcheckProviderError,
  mockProvider,
  semantic,
} from "edcheck";
import type { SemanticProvider, SemanticRequest, SemanticResponse } from "edcheck";

const grouped = z.object({
  a: z.string(),
  b: z.string(),
  c: z.string(),
  d: z.string(),
});

const groupedData = { a: "1", b: "2", c: "3", d: "4" };

const sixFieldSchema = z.object({
  fullName: z.string(),
  age: z.number(),
  email: z.string(),
  bio: z.string(),
  role: z.string(),
  city: z.string(),
});

const sixRules = {
  fullName: semantic("A plausible full name for a real person"),
  age: semantic("A plausible age for a person"),
  email: semantic("A plausible email address"),
  bio: semantic("Meaningful professional biography"),
  role: semantic("A plausible role"),
  city: semantic("A plausible city name"),
};

const sixData = {
  fullName: "Ana Pérez",
  age: 30,
  email: "ana@example.com",
  bio: "Software engineer in Madrid",
  role: "engineer",
  city: "Madrid",
};

describe("compilation grouping", () => {
  it("Uniform context is still one request", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(sixFieldSchema, { rules: sixRules, context: { domain: "hr" } })
      .safeParse(sixData);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]?.state.context).toEqual({ domain: "hr" });
  });

  it("Distinct rule contexts split into minimal groups", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(grouped, {
        rules: {
          a: semantic({ intent: "A", context: { audience: "x" } }),
          b: semantic({ intent: "B", context: { audience: "x" } }),
          c: semantic({ intent: "C", context: { audience: "y" } }),
          d: semantic("D"),
        },
        context: { domain: "d" },
      })
      .safeParse(groupedData);
    expect(provider.calls).toHaveLength(3);
    expect(provider.calls[0]?.state).toEqual({
      a: "1",
      b: "2",
      context: { domain: "d", audience: "x" },
    });
    expect(Object.keys(provider.calls[0]?.questions ?? {})).toEqual(["a", "b"]);
    expect(provider.calls[1]?.state).toEqual({
      c: "3",
      context: { domain: "d", audience: "y" },
    });
    expect(provider.calls[2]?.state).toEqual({
      d: "4",
      context: { domain: "d" },
    });
  });

  it("Group order follows first declared rule", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(z.object({ p: z.string(), q: z.string(), r: z.string() }), {
        rules: {
          p: semantic({ intent: "P", context: { audience: "A" } }),
          q: semantic({ intent: "Q", context: { audience: "B" } }),
          r: semantic({ intent: "R", context: { audience: "A" } }),
        },
      })
      .safeParse({ p: "p", q: "q", r: "r" });
    expect(Object.keys(provider.calls[0]?.questions ?? {})).toEqual(["p", "r"]);
    expect(Object.keys(provider.calls[1]?.questions ?? {})).toEqual(["q"]);
  });

  it("Excluded rules do not create a group", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(z.object({ a: z.string(), b: z.string() }), {
        rules: {
          a: semantic({ intent: "A", context: { audience: "x" } }),
          b: semantic({ intent: "B", context: { audience: "y" } }),
        },
      })
      .safeParse({ a: 1, b: "ok" });
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]?.state.context).toEqual({ audience: "y" });
  });

  it("Groups run concurrently", async () => {
    const provider = mockProvider({ delayMs: 100 });
    const started = Date.now();
    const result = await createEDcheck({ provider })
      .define(z.object({ a: z.string(), b: z.string(), c: z.string() }), {
        rules: {
          a: semantic({ intent: "A", context: { audience: "x" } }),
          b: semantic({ intent: "B", context: { audience: "y" } }),
          c: semantic({ intent: "C", context: { audience: "z" } }),
        },
      })
      .safeParse({ a: "a", b: "b", c: "c" });
    expect(Date.now() - started).toBeLessThan(250);
    expect(result.issues).toEqual([]);
    expect(provider.calls).toHaveLength(3);
  });

  it("Failing group is isolated", async () => {
    const inner = mockProvider({ answers: { a: 0.9, b: 0.1 } });
    const provider: SemanticProvider & { calls: readonly SemanticRequest[] } = {
      name: "isolating",
      calls: inner.calls,
      async evaluate(
        request: SemanticRequest,
        options: { signal: AbortSignal },
      ): Promise<SemanticResponse> {
        const context = request.state.context as { audience?: string } | undefined;
        if (context?.audience === "x") {
          throw new EDcheckProviderError("network", { message: "group x down" });
        }
        return inner.evaluate(request, options);
      },
    };
    const result = await createEDcheck({ provider })
      .define(z.object({ a: z.string(), b: z.string() }), {
        rules: {
          a: semantic({ intent: "A", context: { audience: "x" } }),
          b: semantic({ intent: "B", context: { audience: "y" } }),
        },
      })
      .safeParse({ a: "a", b: "b" });
    const issueA = result.issues.find((issue) => issue.ruleId === "a");
    const issueB = result.issues.find((issue) => issue.ruleId === "b");
    expect(issueA?.code).toBe("semantic_unavailable");
    expect(issueA?.severity).toBe("warning");
    expect(issueB?.code).toBe("semantic");
    expect(issueB?.probability).toBe(0.1);
  });

  it("Caller abort rejects the whole parse across groups", async () => {
    const inner = mockProvider({ delayMs: 200 });
    const signals: AbortSignal[] = [];
    const provider: SemanticProvider = {
      name: "recording",
      evaluate(
        request: SemanticRequest,
        options: { signal: AbortSignal },
      ): Promise<SemanticResponse> {
        signals.push(options.signal);
        return inner.evaluate(request, options);
      },
    };
    const controller = new AbortController();
    const pending = createEDcheck({ provider })
      .define(z.object({ a: z.string(), b: z.string() }), {
        rules: {
          a: semantic({ intent: "A", context: { audience: "x" } }),
          b: semantic({ intent: "B", context: { audience: "y" } }),
        },
      })
      .safeParse({ a: "a", b: "b" }, { signal: controller.signal });
    setTimeout(() => controller.abort(), 20);
    await expect(pending).rejects.toBeInstanceOf(EDcheckAbortError);
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it("Timeout applies to every group", async () => {
    const provider = mockProvider({ delayMs: 500 });
    const started = Date.now();
    const result = await createEDcheck({ provider, timeoutMs: 30 })
      .define(z.object({ a: z.string(), b: z.string() }), {
        rules: {
          a: semantic({ intent: "A", context: { audience: "x" } }),
          b: semantic({ intent: "B", context: { audience: "y" } }),
        },
      })
      .safeParse({ a: "a", b: "b" });
    expect(Date.now() - started).toBeLessThan(400);
    expect(result.issues).toHaveLength(2);
    expect(result.issues.every((issue) => issue.code === "semantic_unavailable")).toBe(true);
  });
});
