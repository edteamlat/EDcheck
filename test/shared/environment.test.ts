import { afterEach, describe, expect, it, vi } from "vitest";

import { EDcheckEnvironmentError } from "edcheck";

import {
  assertServerEnvironment,
  isBrowserEnvironment,
} from "../../src/shared/index.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isBrowserEnvironment", () => {
  it("is false in Node", () => {
    expect(isBrowserEnvironment()).toBe(false);
  });

  it("is true when window and document are defined", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {});
    expect(isBrowserEnvironment()).toBe(true);
  });
});

describe("assertServerEnvironment", () => {
  it("throws EDcheckEnvironmentError mentioning the API route", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {});
    expect(() => assertServerEnvironment()).toThrow(EDcheckEnvironmentError);
    try {
      assertServerEnvironment();
    } catch (error) {
      expect(error).toBeInstanceOf(EDcheckEnvironmentError);
      expect((error as Error).message).toContain("API route");
    }
  });
});
