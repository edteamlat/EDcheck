import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEDcheck,
  EDcheckConfigError,
  EDcheckEnvironmentError,
  mockProvider,
  semantic,
} from "edcheck";
import { z } from "zod";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createEDcheck instance creation", () => {
  it("returns an object exposing only define", () => {
    const instance = createEDcheck({ provider: mockProvider() });
    expect(Object.keys(instance)).toEqual(["define"]);
  });

  it("rejects a missing provider", () => {
    expect(() => createEDcheck({} as never)).toThrow(EDcheckConfigError);
    try {
      createEDcheck({} as never);
    } catch (error) {
      expect((error as EDcheckConfigError).code).toBe("invalid_option");
    }
  });

  it("rejects inverted instance thresholds", () => {
    expect(() =>
      createEDcheck({
        provider: mockProvider(),
        thresholds: { pass: 0.3, fail: 0.7 },
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_thresholds" }));
  });

  it("rejects an invalid policy", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider(), policy: "maybe" as never }),
    ).toThrowError(expect.objectContaining({ code: "invalid_option" }));
  });

  it("rejects a non-positive timeout", () => {
    expect(() =>
      createEDcheck({ provider: mockProvider(), timeoutMs: 0 }),
    ).toThrowError(expect.objectContaining({ code: "invalid_option" }));
  });
});

describe("server-only guard", () => {
  it("rejects createEDcheck in a browser", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {});
    expect(() => createEDcheck({ provider: mockProvider() })).toThrow(EDcheckEnvironmentError);
    try {
      createEDcheck({ provider: mockProvider() });
    } catch (error) {
      expect((error as Error).message).toContain("API route");
    }
  });

  it("rejects safeParse in a browser after creation elsewhere", async () => {
    const provider = mockProvider();
    const instance = createEDcheck({ provider });
    const bound = instance.define(z.object({ fullName: z.string() }), {
      rules: { fullName: semantic("A plausible full name for a real person") },
    });
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {});
    await expect(bound.safeParse({ fullName: "Ana Pérez" })).rejects.toBeInstanceOf(
      EDcheckEnvironmentError,
    );
    expect(provider.calls).toHaveLength(0);
  });

  it("allows Node without window", () => {
    expect(() => createEDcheck({ provider: mockProvider() })).not.toThrow();
  });
});
