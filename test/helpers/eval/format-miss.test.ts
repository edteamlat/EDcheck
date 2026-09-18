import { describe, expect, it } from "vitest";

import { formatMiss } from "./format-miss.ts";

describe("Eval bands and miss report", () => {
  it("Miss message format", () => {
    expect(
      formatMiss({
        rule: "full-name",
        language: "en",
        id: "neg-keyboard",
        expect: "negative",
        band: "p < 0.65",
        probability: 0.86,
        value: "asdfasdf",
      }),
    ).toBe(
      '[full-name/en/neg-keyboard] expected negative (p < 0.65), observed p=0.86 for "asdfasdf"',
    );
  });

  it("Long values are truncated in messages", () => {
    const value = "a".repeat(300);
    const message = formatMiss({
      rule: "full-name",
      language: "en",
      id: "neg-long",
      expect: "negative",
      band: "p < 0.8",
      probability: 0.9,
      value,
    });
    expect(message).toContain("a".repeat(60) + "…");
    expect(message).not.toContain("a".repeat(61));
  });

  it("Object values are serialized", () => {
    const message = formatMiss({
      rule: "age-occupation",
      language: "en",
      id: "neg-child",
      expect: "negative",
      band: "p < 0.8",
      probability: 0.9,
      value: { age: 7, occupation: "Senior engineer" },
    });
    expect(message).toContain('{"age":7,"occupation":"Senior engineer"}');
  });

  it("Level miss message", () => {
    const message = formatMiss({
      rule: "project-description",
      language: "en",
      id: "clear-edcheck",
      expect: { level: "clear" },
      level: "vague",
      score: 1.2,
      confidence: 0.7,
      value: "A library",
    });
    expect(message).toContain('expected level "clear", observed "vague" (score=1.2, confidence=0.7)');
  });
});
