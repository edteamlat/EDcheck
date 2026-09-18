import { describe, expect, it } from "vitest";

import { DEFAULT_MIN_CONFIDENCE, EDcheckConfigError } from "edcheck";

import { resolveMinConfidence } from "../../src/policy/index.ts";

describe("resolveMinConfidence", () => {
  it("exports the provisional default", () => {
    expect(DEFAULT_MIN_CONFIDENCE).toBe(0.6);
  });

  it("prefers rule over schema over instance over the default", () => {
    expect(
      resolveMinConfidence({
        rule: 0.9,
        schema: 0.5,
        instance: 0.3,
      }),
    ).toBe(0.9);
    expect(resolveMinConfidence({ schema: 0.5, instance: 0.3 })).toBe(0.5);
    expect(resolveMinConfidence({ instance: 0.3 })).toBe(0.3);
    expect(resolveMinConfidence({})).toBe(DEFAULT_MIN_CONFIDENCE);
  });

  it("treats each layer as optional", () => {
    expect(resolveMinConfidence({ rule: 0.2 })).toBe(0.2);
    expect(resolveMinConfidence({ schema: 1 })).toBe(1);
  });

  it("rejects an out-of-range resolved value", () => {
    expect(() => resolveMinConfidence({ instance: 1.2 })).toThrow(EDcheckConfigError);
    try {
      resolveMinConfidence({ rule: -0.1 });
    } catch (error) {
      expect((error as EDcheckConfigError).code).toBe("invalid_confidence");
    }
  });
});
