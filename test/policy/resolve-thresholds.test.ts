import { describe, expect, it } from "vitest";

import { EDcheckConfigError } from "edcheck";

import { DEFAULT_THRESHOLDS, resolveThresholds } from "../../src/policy/index.ts";

describe("resolveThresholds", () => {
  it("exports a frozen provisional default", () => {
    expect(DEFAULT_THRESHOLDS).toEqual({ pass: 0.8, fail: 0.5 });
    expect(Object.isFrozen(DEFAULT_THRESHOLDS)).toBe(true);
  });

  it("merges four levels with later levels winning", () => {
    expect(
      resolveThresholds({
        instance: { pass: 0.6, fail: 0.2 },
        schema: { pass: 0.7 },
        rule: { fail: 0.3 },
      }),
    ).toEqual({ pass: 0.7, fail: 0.3 });
  });

  it("throws when the effective merge is invalid", () => {
    expect(() =>
      resolveThresholds({
        instance: { pass: 0.9 },
        schema: { fail: 0.95 },
      }),
    ).toThrow(EDcheckConfigError);
    try {
      resolveThresholds({ instance: { pass: 0.9 }, schema: { fail: 0.95 } });
    } catch (error) {
      expect((error as EDcheckConfigError).code).toBe("invalid_thresholds");
    }
  });
});
