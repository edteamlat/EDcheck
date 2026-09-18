import { describe, expect, it } from "vitest";

import { resolveSeverity } from "../../src/policy/index.ts";

describe("resolveSeverity", () => {
  it.each([
    { outcome: "fail" as const, ruleSeverity: "error" as const, expected: "error" },
    { outcome: "fail" as const, ruleSeverity: "warning" as const, expected: "warning" },
    { outcome: "warning" as const, ruleSeverity: "error" as const, expected: "warning" },
    { outcome: "warning" as const, ruleSeverity: "info" as const, expected: "info" },
    { outcome: "fail" as const, ruleSeverity: "info" as const, expected: "info" },
  ])(
    "$outcome with $ruleSeverity resolves to $expected",
    ({ outcome, ruleSeverity, expected }) => {
      expect(resolveSeverity(outcome, ruleSeverity)).toBe(expected);
    },
  );
});
