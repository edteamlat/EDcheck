import { describe, expect, it } from "vitest";

import { isEmptyContext, mergeContexts } from "../../src/context/index.ts";

describe("mergeContexts", () => {
  it("applies four-level precedence for reserved and open keys", () => {
    expect(
      mergeContexts([
        { locale: "en", tenant: "a" },
        { locale: "es", tenant: "b" },
        { locale: "es-BO" },
        { tenant: "c" },
      ]),
    ).toEqual({ locale: "es-BO", tenant: "c" });
  });

  it("skips missing levels", () => {
    expect(mergeContexts([{ domain: "hr" }, { purpose: "signup" }])).toEqual({
      domain: "hr",
      purpose: "signup",
    });
  });

  it("concatenates notes in order", () => {
    expect(
      mergeContexts([{ notes: ["I"] }, { notes: ["S"] }, { notes: ["N"] }, { notes: ["R"] }]),
    ).toEqual({ notes: ["I", "S", "N", "R"] });
  });

  it("lets a string-equivalent level append a note without overriding keys", () => {
    expect(mergeContexts([{ domain: "software", locale: "es" }, { notes: ["Focus on tone"] }])).toEqual({
      domain: "software",
      locale: "es",
      notes: ["Focus on tone"],
    });
  });

  it("keeps first-introducer key insertion order", () => {
    expect(Object.keys(mergeContexts([{ domain: "x" }, { locale: "es", domain: "y" }]))).toEqual([
      "domain",
      "locale",
    ]);
  });

  it("emits notes last and only when non-empty", () => {
    expect(Object.keys(mergeContexts([{ notes: ["note"] }, { domain: "x" }]))).toEqual([
      "domain",
      "notes",
    ]);
    expect(mergeContexts([{ domain: "x" }])).toEqual({ domain: "x" });
  });

  it("returns an empty object when every level is empty", () => {
    expect(mergeContexts([{}, {}])).toEqual({});
  });
});

describe("isEmptyContext", () => {
  it("is true for {} and false when notes exist", () => {
    expect(isEmptyContext({})).toBe(true);
    expect(isEmptyContext({ notes: ["x"] })).toBe(false);
  });
});
