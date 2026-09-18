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

describe("rule kind discriminator", () => {
  it("defaults kind to noul", () => {
    expect(semantic({ intent: "A name" }).kind).toBe("noul");
  });

  it("rejects an unknown kind", () => {
    expect(() => semantic({ intent: "A name", kind: "choice" } as never)).toThrowError(
      expect.objectContaining({ name: "EDcheckConfigError", code: "invalid_option" }),
    );
  });

  it("rejects score options on a noul rule", () => {
    expect(() =>
      semantic({
        intent: "A name",
        levels: [
          { label: "a", outcome: "fail" },
          { label: "b", outcome: "pass" },
        ],
      } as never),
    ).toThrowError(expect.objectContaining({ code: "invalid_option" }));
    expect(() => semantic({ intent: "A name", minConfidence: 0.5 } as never)).toThrowError(
      expect.objectContaining({ code: "invalid_option" }),
    );
  });

  it("rejects noul options on a score rule", () => {
    const levels = [
      { label: "a", outcome: "fail" as const },
      { label: "b", outcome: "pass" as const },
    ];
    expect(() =>
      semantic({ kind: "score", intent: "Scale", levels, thresholds: { pass: 0.9 } } as never),
    ).toThrowError(expect.objectContaining({ code: "invalid_option" }));
    expect(() =>
      semantic({ kind: "score", intent: "Scale", levels, valid: "x" } as never),
    ).toThrowError(expect.objectContaining({ code: "invalid_option" }));
    expect(() =>
      semantic({ kind: "score", intent: "Scale", levels, invalid: "y" } as never),
    ).toThrowError(expect.objectContaining({ code: "invalid_option" }));
  });
});

describe("score rule options", () => {
  it("creates a valid frozen score rule", () => {
    const rule = semantic({
      kind: "score",
      intent: "How clear is the description?",
      levels: [
        { label: "meaningless", description: "Random text", outcome: "fail" },
        { label: "vague", outcome: "warning" },
        { label: "clear", outcome: "pass" },
      ],
      minConfidence: 0.7,
    });
    expect(rule.kind).toBe("score");
    expect(rule.levels).toHaveLength(3);
    expect(rule.levels[1]?.description).toBe("vague");
    expect(rule.minConfidence).toBe(0.7);
    expect(rule.severity).toBe("error");
    expect(Object.isFrozen(rule)).toBe(true);
    expect(Object.isFrozen(rule.levels)).toBe(true);
  });

  it("rejects fewer than two levels", () => {
    expect(() =>
      semantic({
        kind: "score",
        intent: "Scale",
        levels: [{ label: "only", outcome: "pass" }],
      } as never),
    ).toThrowError(expect.objectContaining({ code: "invalid_rule" }));
    expect(() =>
      semantic({ kind: "score", intent: "Scale", levels: [] } as never),
    ).toThrowError(expect.objectContaining({ code: "invalid_rule" }));
  });

  it("rejects duplicate labels", () => {
    expect(() =>
      semantic({
        kind: "score",
        intent: "Scale",
        levels: [
          { label: "ok", outcome: "fail" },
          { label: "ok", outcome: "pass" },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_rule" }));
  });

  it("rejects an empty label or description", () => {
    expect(() =>
      semantic({
        kind: "score",
        intent: "Scale",
        levels: [
          { label: " ", outcome: "fail" },
          { label: "ok", outcome: "pass" },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_rule" }));
    expect(() =>
      semantic({
        kind: "score",
        intent: "Scale",
        levels: [
          { label: "bad", description: "", outcome: "fail" },
          { label: "ok", outcome: "pass" },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_rule" }));
  });

  it("rejects a missing or unknown level outcome", () => {
    expect(() =>
      semantic({
        kind: "score",
        intent: "Scale",
        levels: [{ label: "a" }, { label: "b", outcome: "pass" }],
      } as never),
    ).toThrowError(expect.objectContaining({ code: "invalid_rule" }));
    expect(() =>
      semantic({
        kind: "score",
        intent: "Scale",
        levels: [
          { label: "a", outcome: "block" },
          { label: "b", outcome: "pass" },
        ],
      } as never),
    ).toThrowError(expect.objectContaining({ code: "invalid_option" }));
  });

  it("rejects minConfidence out of range", () => {
    expect(() =>
      semantic({
        kind: "score",
        intent: "Scale",
        levels: [
          { label: "a", outcome: "fail" },
          { label: "b", outcome: "pass" },
        ],
        minConfidence: 1.2,
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_confidence" }));
    expect(() =>
      semantic({
        kind: "score",
        intent: "Scale",
        levels: [
          { label: "a", outcome: "fail" },
          { label: "b", outcome: "pass" },
        ],
        minConfidence: -0.1,
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_confidence" }));
  });

  it("accepts minConfidence boundaries", () => {
    expect(
      semantic({
        kind: "score",
        intent: "Scale",
        levels: [
          { label: "a", outcome: "fail" },
          { label: "b", outcome: "pass" },
        ],
        minConfidence: 0,
      }).minConfidence,
    ).toBe(0);
    expect(
      semantic({
        kind: "score",
        intent: "Scale",
        levels: [
          { label: "a", outcome: "fail" },
          { label: "b", outcome: "pass" },
        ],
        minConfidence: 1,
      }).minConfidence,
    ).toBe(1);
  });

  it("copies levels so later mutation does not affect the rule", () => {
    const levels: Array<{ label: string; outcome: "fail" | "pass" }> = [
      { label: "a", outcome: "fail" },
      { label: "b", outcome: "pass" },
    ];
    const rule = semantic({
      kind: "score",
      intent: "Scale",
      levels: [levels[0]!, levels[1]!],
    });
    levels.push({ label: "c", outcome: "pass" });
    expect(rule.levels).toHaveLength(2);
  });
});
