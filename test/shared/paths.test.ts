import { describe, expect, it } from "vitest";

import {
  formatPath,
  getAtPath,
  isPathPrefix,
  parsePath,
  setAtPath,
} from "../../src/shared/index.ts";

describe("parsePath", () => {
  it("splits a dotted path into segments", () => {
    expect(parsePath("a.b.c")).toEqual(["a", "b", "c"]);
  });
});

describe("formatPath", () => {
  it("joins segments with dots", () => {
    expect(formatPath(["a", "b"])).toBe("a.b");
  });
});

describe("isPathPrefix", () => {
  it("treats the root path as a prefix of every path", () => {
    expect(isPathPrefix([], ["a"])).toBe(true);
    expect(isPathPrefix([], [])).toBe(true);
    expect(isPathPrefix([], ["a", "b"])).toBe(true);
  });

  it("accepts a true prefix and rejects a longer or sibling path", () => {
    expect(isPathPrefix(["a"], ["a", "b"])).toBe(true);
    expect(isPathPrefix(["a", "b"], ["a"])).toBe(false);
    expect(isPathPrefix(["a"], ["ab"])).toBe(false);
  });
});

describe("getAtPath", () => {
  it("returns undefined when a segment is missing", () => {
    expect(getAtPath({ a: { b: 1 } }, ["a", "c"])).toBeUndefined();
    expect(getAtPath({ a: 1 }, ["a", "b"])).toBeUndefined();
    expect(getAtPath(null, ["a"])).toBeUndefined();
  });

  it("reads a nested value", () => {
    expect(getAtPath({ a: { b: "ok" } }, ["a", "b"])).toBe("ok");
  });
});

describe("setAtPath", () => {
  it("creates nested objects and does not touch sibling keys", () => {
    const target: Record<string, unknown> = { keep: true, nested: { sibling: 1 } };
    setAtPath(target, ["nested", "added"], "value");
    expect(target).toEqual({
      keep: true,
      nested: { sibling: 1, added: "value" },
    });
  });
});
