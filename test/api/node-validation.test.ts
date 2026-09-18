import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createEDcheck,
  EDcheckAbortError,
  EDcheckConfigError,
  mockProvider,
  semantic,
  type SemanticProvider,
  type SemanticRequest,
  type SemanticResponse,
} from "edcheck";

const pdrProjectContext = {
  domain: "software services",
  purpose: "create_project",
  audience: "client",
  locale: "es-BO",
};

const firstPositiveName = "Ana Pérez";

const nameRule = semantic("A plausible full name for a real person");
const streetRule = semantic("A plausible street address");
const cityRule = semantic("A plausible city name");

const User = z.object({
  fullName: z.string(),
  bio: z.string(),
  address: z.object({
    street: z.string(),
    city: z.string(),
  }),
});

function defineUser(provider = mockProvider()) {
  return createEDcheck({ provider }).define(User, {
    rules: { fullName: nameRule },
  });
}

describe("node handle construction", () => {
  it("returns a leaf node handle", () => {
    const node = defineUser().node("fullName");
    expect(node.path).toEqual(["fullName"]);
    expect(node.ruleIds).toEqual(["fullName"]);
    expect(node.schema.safeParse("x").success).toBe(true);
    expect(typeof node.safeParse).toBe("function");
  });

  it("selects nested rules on an object node", () => {
    const node = createEDcheck({ provider: mockProvider() })
      .define(User, {
        rules: {
          "address.street": streetRule,
          "address.city": cityRule,
          fullName: nameRule,
        },
      })
      .node("address");
    expect(node.path).toEqual(["address"]);
    expect(node.ruleIds).toEqual(["address.street", "address.city"]);
  });

  it("memoizes the handle", () => {
    const bound = defineUser();
    expect(bound.node("fullName")).toBe(bound.node("fullName"));
  });

  it("allows a rule-less node", () => {
    const node = defineUser().node("bio");
    expect(node.ruleIds).toEqual([]);
  });

  it("freezes ruleIds", () => {
    const node = defineUser().node("fullName");
    expect(() => {
      (node.ruleIds as string[]).push("x");
    }).toThrow();
    expect(node.ruleIds).toEqual(["fullName"]);
  });

  it("rejects unknown paths", () => {
    const bound = defineUser();
    for (const path of ["nope", "address.nope", ""] as const) {
      expect(() => bound.node(path as never)).toThrow(EDcheckConfigError);
      try {
        bound.node(path as never);
      } catch (error) {
        expect(error).toMatchObject({ code: "unknown_path" });
        expect((error as Error).message).toContain(path === "" ? '""' : path);
      }
    }
  });

  it("rejects array paths", () => {
    const bound = createEDcheck({ provider: mockProvider() }).define(
      z.object({
        tags: z.array(z.string()),
        items: z.array(z.object({ name: z.string() })),
      }),
      { rules: {} },
    );
    expect(() => bound.node("tags" as never)).toThrowError(
      expect.objectContaining({ code: "unsupported_node" }),
    );
    expect(() => bound.node("items.name" as never)).toThrowError(
      expect.objectContaining({ code: "unsupported_node" }),
    );
  });

  it("rejects a pipe node", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() })
        .define(z.object({ slug: z.string().pipe(z.string().min(1)) }), { rules: {} })
        .node("slug" as never),
    ).toThrowError(expect.objectContaining({ code: "unsupported_node" }));
  });

  it("rejects a reserved path", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider() })
        .define(z.object({ context: z.string() }), { rules: {} })
        .node("context" as never),
    ).toThrowError(expect.objectContaining({ code: "reserved_path" }));
  });

  it("keeps wrappers on the resolved node", () => {
    const node = createEDcheck({ provider: mockProvider() })
      .define(
        z.object({ nickname: z.string().trim().optional().default("anon") }),
        { rules: { nickname: semantic("A nickname") } },
      )
      .node("nickname");
    expect(node.schema.parse(undefined)).toBe("anon");
    expect(node.schema.parse("  bob ")).toBe("bob");
  });
});

describe("rule selection for a node", () => {
  it("does not select sibling rules", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(User, { rules: { fullName: nameRule, bio: semantic("A bio") } })
      .node("fullName")
      .safeParse("Ada Lovelace");
    expect(Object.keys(provider.calls[0]?.questions ?? {})).toEqual(["fullName"]);
  });

  it("selects nested rules under an object node", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(User, {
        rules: {
          "address.street": streetRule,
          "address.city": cityRule,
          fullName: nameRule,
        },
      })
      .node("address")
      .safeParse({ street: "Main St 1", city: "Lima" });
    expect(Object.keys(provider.calls[0]?.questions ?? {})).toEqual([
      "address.street",
      "address.city",
    ]);
  });

  it("runs a cross-field rule fully covered by the node", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(
      z.object({
        address: z.object({ city: z.string(), country: z.string() }),
      }),
      {
        rules: {},
        crossField: [
          {
            paths: ["address.city", "address.country"],
            rule: semantic("The `address.city` belongs in `address.country`"),
          },
        ],
      },
    );
    const node = bound.node("address");
    expect(node.ruleIds).toContain("address.city+address.country");
    await node.safeParse({ city: "Lima", country: "Peru" });
    expect(provider.calls[0]?.questions).toHaveProperty("address.city+address.country");
    expect(provider.calls[0]?.state.address).toEqual({ city: "Lima", country: "Peru" });
  });

  it("skips a partially covered cross-field rule", async () => {
    const provider = mockProvider();
    const bound = createEDcheck({ provider }).define(
      z.object({ age: z.number(), occupation: z.string() }),
      {
        rules: { age: semantic("A plausible age") },
        crossField: [
          {
            paths: ["age", "occupation"],
            rule: semantic("The `occupation` is plausible given `age`"),
          },
        ],
      },
    );
    const node = bound.node("age");
    expect(node.ruleIds).toEqual(["age"]);
    const result = await node.safeParse(30);
    expect(Object.keys(provider.calls[0]?.questions ?? {})).toEqual(["age"]);
    expect(result.issues).toEqual([]);
  });

  it("skips a node that only has a partial cross-field rule", async () => {
    const provider = mockProvider();
    const result = await createEDcheck({ provider })
      .define(z.object({ age: z.number(), occupation: z.string() }), {
        rules: {},
        crossField: [
          {
            paths: ["age", "occupation"],
            rule: semantic("The `occupation` is plausible given `age`"),
          },
        ],
      })
      .node("occupation")
      .safeParse("pilot");
    expect(provider.calls).toHaveLength(0);
    expect(result).toEqual({ success: true, data: "pilot", issues: [] });
  });
});

describe("node pipeline", () => {
  it("fails shape on the node without calling the provider", async () => {
    const provider = mockProvider();
    const result = await defineUser(provider).node("fullName").safeParse(42);
    expect(provider.calls).toHaveLength(0);
    expect(result.success).toBe(false);
    expect(result.issues[0]).toMatchObject({
      path: ["fullName"],
      severity: "error",
      code: "invalid_type",
    });
  });

  it("prefixes a nested shape issue with the node path", async () => {
    const result = await createEDcheck({ provider: mockProvider() })
      .define(User, { rules: { "address.street": streetRule } })
      .node("address")
      .safeParse({ street: 1, city: "Lima" });
    expect(result.issues.some((issue) => issue.path.join(".") === "address.street")).toBe(true);
  });

  it("excludes only the invalid child's rule", async () => {
    const provider = mockProvider({ answers: { "address.city": 0.12 } });
    const result = await createEDcheck({ provider })
      .define(User, {
        rules: { "address.street": streetRule, "address.city": cityRule },
      })
      .node("address")
      .safeParse({ street: 1, city: "Lima" });
    expect(Object.keys(provider.calls[0]?.questions ?? {})).toEqual(["address.city"]);
    expect(result.issues[0]?.path).toEqual(["address", "street"]);
    expect(result.issues.some((issue) => issue.ruleId === "address.city")).toBe(true);
  });

  it("skips a nullish optional value", async () => {
    const provider = mockProvider();
    const result = await createEDcheck({ provider })
      .define(z.object({ nickname: z.string().optional() }), {
        rules: { nickname: semantic("A nickname") },
      })
      .node("nickname")
      .safeParse(undefined);
    expect(provider.calls).toHaveLength(0);
    expect(result).toEqual({ success: true, data: undefined, issues: [] });
  });

  it("evaluates a default value", async () => {
    const provider = mockProvider();
    const result = await createEDcheck({ provider })
      .define(z.object({ nickname: z.string().default("anon") }), {
        rules: { nickname: semantic("A nickname") },
      })
      .node("nickname")
      .safeParse(undefined);
    expect(provider.calls[0]?.state).toEqual({ nickname: "anon" });
    expect(result.data).toBe("anon");
  });

  it("evaluates a trimmed value", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(z.object({ fullName: z.string().trim() }), { rules: { fullName: nameRule } })
      .node("fullName")
      .safeParse("  Ada Lovelace  ");
    expect(provider.calls[0]?.state.fullName).toBe("Ada Lovelace");
  });

  it("mirrors the absolute state structure", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(User, { rules: { "address.street": streetRule } })
      .node("address.street")
      .safeParse("Main St 1");
    expect(provider.calls[0]?.state).toEqual({ address: { street: "Main St 1" } });
  });

  it("matches the whole-object payload for a single-rule schema", async () => {
    const objectProvider = mockProvider();
    const nodeProvider = mockProvider();
    const schema = z.object({ fullName: z.string(), bio: z.string() });
    const objectBound = createEDcheck({ provider: objectProvider }).define(schema, {
      rules: { fullName: nameRule },
    });
    const nodeBound = createEDcheck({ provider: nodeProvider }).define(schema, {
      rules: { fullName: nameRule },
    });
    await objectBound.safeParse({ fullName: "Ada Lovelace", bio: "x" });
    await nodeBound.node("fullName").safeParse("Ada Lovelace");
    expect(nodeProvider.calls[0]).toEqual(objectProvider.calls[0]);
    expect(nodeProvider.calls[0]).toMatchSnapshot();
  });

  it("keeps the compiled question text", async () => {
    const objectProvider = mockProvider();
    const nodeProvider = mockProvider();
    const schema = z.object({ fullName: z.string() });
    await createEDcheck({ provider: objectProvider })
      .define(schema, { rules: { fullName: nameRule } })
      .safeParse({ fullName: "Ada Lovelace" });
    await createEDcheck({ provider: nodeProvider })
      .define(schema, { rules: { fullName: nameRule } })
      .node("fullName")
      .safeParse("Ada Lovelace");
    expect(nodeProvider.calls[0]?.questions.fullName?.instructions).toBe(
      objectProvider.calls[0]?.questions.fullName?.instructions,
    );
  });

  it("passes extreme strings through unchanged", async () => {
    const values = ["", "x".repeat(20_000), "👩‍🚀 Ada", "عادة لوفليس"];
    for (const value of values) {
      const provider = mockProvider();
      await createEDcheck({ provider })
        .define(z.object({ fullName: z.string() }), { rules: { fullName: nameRule } })
        .node("fullName")
        .safeParse(value);
      expect(provider.calls[0]?.state.fullName).toBe(value);
    }
  });

  it("keeps unknown keys on a passthrough object node", async () => {
    const provider = mockProvider();
    const result = await createEDcheck({ provider })
      .define(
        z.object({ address: z.object({ street: z.string() }).passthrough() }),
        { rules: { "address.street": streetRule } },
      )
      .node("address")
      .safeParse({ street: "Main St 1", extra: 1 });
    expect(result.data).toEqual({ street: "Main St 1", extra: 1 });
    expect(provider.calls[0]?.state).toEqual({ address: { street: "Main St 1" } });
  });

  it("maps outcomes like the whole-object parse", async () => {
    const objectResult = await createEDcheck({
      provider: mockProvider({ answers: { fullName: 0.12 } }),
    })
      .define(z.object({ fullName: z.string() }), { rules: { fullName: nameRule } })
      .safeParse({ fullName: "asdf" });
    const nodeResult = await createEDcheck({
      provider: mockProvider({ answers: { fullName: 0.12 } }),
    })
      .define(z.object({ fullName: z.string() }), { rules: { fullName: nameRule } })
      .node("fullName")
      .safeParse("asdf");
    expect(nodeResult.success).toBe(false);
    const objectIssue = objectResult.issues[0];
    expect(nodeResult.issues[0]).toMatchObject({
      path: objectIssue?.path,
      code: objectIssue?.code,
      severity: objectIssue?.severity,
      outcome: objectIssue?.outcome,
      message: objectIssue?.message,
      ruleId: objectIssue?.ruleId,
      probability: objectIssue?.probability,
      thresholds: objectIssue?.thresholds,
      provider: objectIssue?.provider,
    });
  });

  it("keeps success on a warning", async () => {
    const result = await createEDcheck({
      provider: mockProvider({ answers: { fullName: 0.6 } }),
      thresholds: { pass: 0.8, fail: 0.5 },
    })
      .define(z.object({ fullName: z.string() }), { rules: { fullName: nameRule } })
      .node("fullName")
      .safeParse("Ada");
    expect(result.success).toBe(true);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.severity).toBe("warning");
  });

  it("performs only a shape check on a rule-less node", async () => {
    const provider = mockProvider();
    const node = defineUser(provider).node("bio");
    const ok = await node.safeParse("hello");
    const bad = await node.safeParse(5);
    expect(provider.calls).toHaveLength(0);
    expect(ok).toEqual({ success: true, data: "hello", issues: [] });
    expect(bad.issues).toHaveLength(1);
    expect(bad.issues[0]?.path).toEqual(["bio"]);
  });

  it("matches the full-name fixture snapshot content", async () => {
    const objectProvider = mockProvider();
    const nodeProvider = mockProvider();
    const schema = z.object({ fullName: z.string() });
    await createEDcheck({ provider: objectProvider })
      .define(schema, { rules: { fullName: nameRule }, context: pdrProjectContext })
      .safeParse({ fullName: firstPositiveName });
    await createEDcheck({ provider: nodeProvider })
      .define(schema, { rules: { fullName: nameRule }, context: pdrProjectContext })
      .node("fullName")
      .safeParse(firstPositiveName);
    expect(nodeProvider.calls[0]).toEqual(objectProvider.calls[0]);
    expect(nodeProvider.calls[0]).toMatchSnapshot();
  });
});

describe("context preservation in node parses", () => {
  it("sends instance and schema context", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider, context: { domain: "hr" } })
      .define(z.object({ fullName: z.string() }), {
        context: "Spanish-speaking users",
        rules: { fullName: nameRule },
      })
      .node("fullName")
      .safeParse("Ada");
    expect(provider.calls[0]?.state.context).toEqual({
      domain: "hr",
      notes: ["Spanish-speaking users"],
    });
  });

  it("sends ancestor node context to a nested node", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(User, {
        rules: { "address.street": streetRule },
        nodeContext: { address: { purpose: "shipping" } },
      })
      .node("address.street")
      .safeParse("Main St 1");
    expect((provider.calls[0]?.state.context as { purpose?: string }).purpose).toBe("shipping");
  });

  it("lets rule context win", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider, context: { audience: "adults" } })
      .define(z.object({ fullName: z.string() }), {
        rules: {
          fullName: semantic({ intent: "A name", context: { audience: "children" } }),
        },
      })
      .node("fullName")
      .safeParse("Ada");
    expect(provider.calls[0]?.state.context).toEqual({ audience: "children" });
  });

  it("matches whole-object context for address.street", async () => {
    const options = {
      context: { domain: "hr", purpose: "signup" },
      nodeContext: { address: { channel: "web" } },
      rules: {
        "address.street": semantic({
          intent: "A street",
          context: { audience: "ops" },
        }),
      },
    };
    const objectProvider = mockProvider();
    const nodeProvider = mockProvider();
    await createEDcheck({ provider: objectProvider })
      .define(User, options)
      .safeParse({
        fullName: "Ada",
        bio: "x",
        address: { street: "Main St 1", city: "Lima" },
      });
    await createEDcheck({ provider: nodeProvider })
      .define(User, options)
      .node("address.street")
      .safeParse("Main St 1");
    expect(nodeProvider.calls[0]?.state.context).toEqual(objectProvider.calls[0]?.state.context);
  });

  it("splits requests when contexts differ inside an object node", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(User, {
        rules: {
          "address.street": semantic({ intent: "A street", context: { audience: "a" } }),
          "address.city": semantic({ intent: "A city", context: { audience: "b" } }),
        },
      })
      .node("address")
      .safeParse({ street: "s", city: "c" });
    expect(provider.calls).toHaveLength(2);
    expect(Object.keys(provider.calls[0]?.questions ?? {})).toHaveLength(1);
    expect(Object.keys(provider.calls[1]?.questions ?? {})).toHaveLength(1);
    const audiences = provider.calls.map(
      (call) => (call.state.context as { audience: string }).audience,
    );
    expect(audiences.sort()).toEqual(["a", "b"]);
  });

  it("omits the context key when empty", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(z.object({ fullName: z.string() }), { rules: { fullName: nameRule } })
      .node("fullName")
      .safeParse("Ada");
    expect("context" in (provider.calls[0]?.state ?? {})).toBe(false);
  });
});

function deferredProvider(answerFor: (request: SemanticRequest) => number) {
  const releases: Array<(response: SemanticResponse) => void> = [];
  const requests: SemanticRequest[] = [];
  const provider: SemanticProvider = {
    name: "deferred",
    evaluate(request, { signal }) {
      requests.push(request);
      return new Promise<SemanticResponse>((resolve, reject) => {
        let settled = false;
        const finish = (action: () => void): void => {
          if (!settled) {
            settled = true;
            action();
          }
        };
        signal.addEventListener(
          "abort",
          () => finish(() => reject(signal.reason)),
          { once: true },
        );
        if (signal.aborted) {
          finish(() => reject(signal.reason));
          return;
        }
        releases.push((response) => finish(() => resolve(response)));
      });
    },
  };
  return {
    provider,
    requests,
    release(index: number): void {
      const request = requests[index];
      const release = releases[index];
      if (request === undefined || release === undefined) {
        throw new Error(`no pending request at ${index}`);
      }
      const noul = answerFor(request);
      const answers: SemanticResponse["answers"] = {};
      for (const id of Object.keys(request.questions)) {
        answers[id] = { type: "noul", noul };
      }
      release({ model: "deferred", answers });
    },
  };
}

describe("node cancellation and concurrency", () => {
  it("rejects a pre-aborted signal", async () => {
    const provider = mockProvider();
    const controller = new AbortController();
    controller.abort(new Error("already"));
    await expect(
      defineUser(provider).node("fullName").safeParse("Ada", { signal: controller.signal }),
    ).rejects.toBeInstanceOf(EDcheckAbortError);
    expect(provider.calls).toHaveLength(0);
  });

  it("rejects an in-flight abort even if the provider later resolves", async () => {
    const deferred = deferredProvider(() => 0.95);
    const controller = new AbortController();
    const rejections: unknown[] = [];
    const listener = (reason: unknown) => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", listener);
    const pending = createEDcheck({ provider: deferred.provider })
      .define(z.object({ fullName: z.string() }), { rules: { fullName: nameRule } })
      .node("fullName")
      .safeParse("Ada", { signal: controller.signal });
    await Promise.resolve();
    controller.abort(new Error("blurred"));
    await expect(pending).rejects.toBeInstanceOf(EDcheckAbortError);
    deferred.release(0);
    await new Promise((resolve) => setTimeout(resolve, 20));
    process.off("unhandledRejection", listener);
    expect(rejections).toEqual([]);
  });

  it("preserves the abort reason", async () => {
    const controller = new AbortController();
    const reason = new Error("blurred again");
    const pending = defineUser(mockProvider({ delayMs: 200 }))
      .node("fullName")
      .safeParse("Ada", { signal: controller.signal });
    setTimeout(() => controller.abort(reason), 10);
    const rejected = await pending.catch((error: unknown) => error);
    expect(rejected).toBeInstanceOf(EDcheckAbortError);
    expect((rejected as EDcheckAbortError).cause).toBe(reason);
  });

  it("keeps overlapping calls independent when one is aborted", async () => {
    const provider = mockProvider({ delayMs: 100 });
    const node = defineUser(provider).node("fullName");
    const first = new AbortController();
    const second = new AbortController();
    const pendingA = node.safeParse("A", { signal: first.signal });
    const pendingB = node.safeParse("B", { signal: second.signal });
    setTimeout(() => first.abort(), 10);
    await expect(pendingA).rejects.toBeInstanceOf(EDcheckAbortError);
    const resultB = await pendingB;
    expect(resultB.success).toBe(true);
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[1]?.state.fullName).toBe("B");
  });

  it("resolves overlapping calls with their own values", async () => {
    const deferred = deferredProvider((request) =>
      request.state.fullName === "asdf" ? 0.1 : 0.95,
    );
    const node = createEDcheck({ provider: deferred.provider })
      .define(z.object({ fullName: z.string() }), { rules: { fullName: nameRule } })
      .node("fullName");
    const pendingFail = node.safeParse("asdf");
    const pendingPass = node.safeParse("Ada Lovelace");
    await Promise.resolve();
    deferred.release(1);
    deferred.release(0);
    const fail = await pendingFail;
    const pass = await pendingPass;
    expect(fail.issues).toHaveLength(1);
    expect(fail.issues[0]?.outcome).toBe("fail");
    expect(pass.issues).toEqual([]);
  });

  it("maps timeout to unavailable under open", async () => {
    const provider = mockProvider({ delayMs: 500 });
    const result = await createEDcheck({ provider, timeoutMs: 20 })
      .define(z.object({ fullName: z.string() }), { rules: { fullName: nameRule } })
      .node("fullName")
      .safeParse("Ada");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      code: "semantic_unavailable",
      severity: "warning",
      path: ["fullName"],
    });
  });

  it("maps timeout to an error under closed", async () => {
    const result = await createEDcheck({
      provider: mockProvider({ delayMs: 500 }),
      timeoutMs: 20,
      policy: "closed",
    })
      .define(z.object({ fullName: z.string() }), { rules: { fullName: nameRule } })
      .node("fullName")
      .safeParse("Ada");
    expect(result.success).toBe(false);
    expect(result.issues[0]?.severity).toBe("error");
  });

  it("lets a per-call timeout override the instance", async () => {
    const result = await createEDcheck({
      provider: mockProvider({ delayMs: 200 }),
      timeoutMs: 10000,
    })
      .define(z.object({ fullName: z.string() }), { rules: { fullName: nameRule } })
      .node("fullName")
      .safeParse("Ada", { timeoutMs: 20 });
    expect(result.issues[0]?.code).toBe("semantic_unavailable");
  });

  it("leaves the caller signal untouched on a fast parse", async () => {
    const controller = new AbortController();
    await defineUser()
      .node("fullName")
      .safeParse("Ada", { signal: controller.signal });
    expect(controller.signal.aborted).toBe(false);
  });

  it("does not supersede overlapping calls", async () => {
    const provider = mockProvider({ delayMs: 50 });
    const node = defineUser(provider).node("fullName");
    const first = node.safeParse("A");
    const second = node.safeParse("B");
    const results = await Promise.all([first, second]);
    expect(results.every((result) => result.success)).toBe(true);
    expect(provider.calls).toHaveLength(2);
  });
});
