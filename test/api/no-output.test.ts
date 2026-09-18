import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  createEDcheck,
  EDcheckProviderError,
  mockProvider,
  semantic,
} from "edcheck";

const schema = z.object({ fullName: z.string(), bio: z.string() });
const rules = {
  fullName: semantic("A plausible full name for a real person"),
  bio: semantic("Meaningful professional biography"),
};
const data = { fullName: "Ana Pérez", bio: "Engineer" };

describe("no output by default", () => {
  const spies: Array<ReturnType<typeof vi.spyOn>> = [];

  afterEach(() => {
    for (const spy of spies.splice(0)) {
      spy.mockRestore();
    }
  });

  it("is silent across outcomes", async () => {
    spies.push(
      vi.spyOn(process.stdout, "write"),
      vi.spyOn(process.stderr, "write"),
      vi.spyOn(console, "log"),
      vi.spyOn(console, "info"),
      vi.spyOn(console, "warn"),
      vi.spyOn(console, "error"),
      vi.spyOn(console, "debug"),
    );
    const throwing = {
      onRequest: () => {
        throw new Error("hook");
      },
      onResponse: () => {
        throw new Error("hook");
      },
      onError: () => {
        throw new Error("hook");
      },
    };
    await createEDcheck({ provider: mockProvider(), hooks: throwing })
      .define(schema, { rules })
      .safeParse(data);
    await createEDcheck({
      provider: mockProvider({ answers: { fullName: 0.1 } }),
      hooks: throwing,
    })
      .define(schema, { rules: { fullName: rules.fullName } })
      .safeParse({ fullName: "xx", bio: "Engineer" });
    await createEDcheck({
      provider: mockProvider({ delayMs: 200 }),
      timeoutMs: 20,
      hooks: throwing,
    })
      .define(schema, { rules })
      .safeParse(data);
    const controller = new AbortController();
    const pending = createEDcheck({
      provider: mockProvider({ delayMs: 200 }),
      hooks: throwing,
    })
      .define(schema, { rules })
      .safeParse(data, { signal: controller.signal });
    setTimeout(() => controller.abort(new Error("nav")), 10);
    await pending.catch(() => undefined);
    await createEDcheck({
      provider: mockProvider({ error: new EDcheckProviderError("http", { status: 503 }) }),
      hooks: throwing,
    })
      .define(schema, { rules })
      .safeParse(data);
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
