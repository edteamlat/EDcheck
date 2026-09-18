import { describe, expect, it } from "vitest";

import { EDcheckConfigError, semantic } from "edcheck";

describe("semantic() basic statement", () => {
  it("turns a statement into a Noul rule with defaults", () => {
    const rule = semantic("A plausible full name for a real person");
    expect(rule).toEqual({
      kind: "noul",
      intent: "A plausible full name for a real person",
      severity: "error",
    });
    expect(rule.valid).toBeUndefined();
    expect(rule.invalid).toBeUndefined();
    expect(rule.thresholds).toBeUndefined();
    expect(rule.message).toBeUndefined();
    expect(rule.id).toBeUndefined();
  });

  it("rejects an empty or whitespace statement", () => {
    expect(() => semantic("")).toThrow(EDcheckConfigError);
    expect(() => semantic("   \n")).toThrow(EDcheckConfigError);
    try {
      semantic("");
    } catch (error) {
      expect(error).toBeInstanceOf(EDcheckConfigError);
      expect((error as EDcheckConfigError).code).toBe("invalid_rule");
    }
  });
});

describe("semantic() advanced options", () => {
  it("preserves all options", () => {
    const rule = semantic({
      intent: "Meaningful professional biography",
      valid: "Reads as a real bio",
      invalid: "Looks like filler",
      thresholds: { pass: 0.9, fail: 0.3 },
      severity: "warning",
      message: "Custom",
      id: "bio_meaningful",
    });
    expect(rule).toEqual({
      kind: "noul",
      intent: "Meaningful professional biography",
      valid: "Reads as a real bio",
      invalid: "Looks like filler",
      thresholds: { pass: 0.9, fail: 0.3 },
      severity: "warning",
      message: "Custom",
      id: "bio_meaningful",
    });
  });

  it("allows partial criteria", () => {
    const rule = semantic({ intent: "A name", valid: "Looks like a real name" });
    expect(rule.valid).toBe("Looks like a real name");
    expect(rule.invalid).toBeUndefined();
  });

  it("rejects an empty intent", () => {
    expect(() => semantic({ intent: "  " })).toThrowError(
      expect.objectContaining({ name: "EDcheckConfigError", code: "invalid_rule" }),
    );
  });

  it("validates rule thresholds in isolation", () => {
    expect(() => semantic({ intent: "A name", thresholds: { pass: 0.4, fail: 0.6 } })).toThrowError(
      expect.objectContaining({ name: "EDcheckConfigError", code: "invalid_thresholds" }),
    );
    expect(() => semantic({ intent: "A name", thresholds: { pass: 1.2 } })).toThrowError(
      expect.objectContaining({ name: "EDcheckConfigError", code: "invalid_thresholds" }),
    );
    expect(() => semantic({ intent: "A name", thresholds: { fail: -0.1 } })).toThrowError(
      expect.objectContaining({ name: "EDcheckConfigError", code: "invalid_thresholds" }),
    );
  });

  it("accepts partial rule thresholds", () => {
    const rule = semantic({ intent: "A name", thresholds: { pass: 0.95 } });
    expect(rule.thresholds).toEqual({ pass: 0.95 });
  });

  it("rejects an unknown severity at runtime", () => {
    expect(() =>
      semantic({ intent: "A name", severity: "fatal" as "error" }),
    ).toThrowError(expect.objectContaining({ name: "EDcheckConfigError", code: "invalid_option" }));
  });

  it("rejects an empty explicit id", () => {
    expect(() => semantic({ intent: "A name", id: "" })).toThrowError(
      expect.objectContaining({ name: "EDcheckConfigError", code: "invalid_rule" }),
    );
  });
});

describe("semantic() immutability", () => {
  it("returns a frozen rule", () => {
    const rule = semantic("A plausible full name for a real person");
    expect(Object.isFrozen(rule)).toBe(true);
    expect(() => {
      (rule as { intent: string }).intent = "x";
    }).toThrow();
  });
});
