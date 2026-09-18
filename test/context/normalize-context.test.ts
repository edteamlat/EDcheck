import { describe, expect, it } from "vitest";

import { EDcheckConfigError } from "edcheck";

import { normalizeContext } from "../../src/context/index.ts";

describe("normalizeContext", () => {
  it("turns a string into a single note", () => {
    expect(normalizeContext("Client intake form")).toEqual({ notes: ["Client intake form"] });
  });

  it("shallow-copies the object and copies notes", () => {
    const notes = ["n"];
    const input = { domain: "a", notes };
    const normalized = normalizeContext(input);
    input.domain = "b";
    notes.push("m");
    expect(normalized).toEqual({ domain: "a", notes: ["n"] });
  });

  it("rejects empty and whitespace strings", () => {
    expect(() => normalizeContext("")).toThrow(EDcheckConfigError);
    expect(() => normalizeContext("   ")).toThrowError(
      expect.objectContaining({ code: "invalid_context" }),
    );
  });

  it("rejects a reserved key with a non-string value", () => {
    expect(() => normalizeContext({ locale: 42 })).toThrowError(
      expect.objectContaining({ code: "invalid_context" }),
    );
  });

  it("rejects invalid notes", () => {
    expect(() => normalizeContext({ notes: ["ok", ""] })).toThrowError(
      expect.objectContaining({ code: "invalid_context" }),
    );
    expect(() => normalizeContext({ notes: "text" })).toThrowError(
      expect.objectContaining({ code: "invalid_context" }),
    );
  });

  it("rejects number, null and array inputs", () => {
    expect(() => normalizeContext(7)).toThrowError(
      expect.objectContaining({ code: "invalid_context" }),
    );
    expect(() => normalizeContext(null)).toThrowError(
      expect.objectContaining({ code: "invalid_context" }),
    );
    expect(() => normalizeContext(["x"])).toThrowError(
      expect.objectContaining({ code: "invalid_context" }),
    );
  });

  it("drops undefined values", () => {
    expect(normalizeContext({ domain: "x", purpose: undefined })).toEqual({ domain: "x" });
  });

  it("keeps an empty object empty", () => {
    expect(normalizeContext({})).toEqual({});
  });
});
