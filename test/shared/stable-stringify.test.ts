import { describe, expect, it } from "vitest";

import { stableStringify } from "../../src/shared/index.ts";

describe("stableStringify", () => {
  it("is independent of key insertion order", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it("sorts nested object keys", () => {
    expect(stableStringify({ z: { b: 1, a: 2 } })).toBe('{"z":{"a":2,"b":1}}');
  });

  it("keeps array order", () => {
    expect(stableStringify({ notes: ["b", "a"] })).toBe('{"notes":["b","a"]}');
  });

  it("throws on cycles", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => stableStringify(cyclic)).toThrow();
  });
});
