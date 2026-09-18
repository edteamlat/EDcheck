import { describe, expect, it } from "vitest";

import { formatPathList } from "../../src/shared/index.ts";

describe("formatPathList", () => {
  it("quotes a single path", () => {
    expect(formatPathList(["a"])).toBe("`a`");
  });

  it("joins two paths with and", () => {
    expect(formatPathList(["a", "b"])).toBe("`a` and `b`");
  });

  it("joins three paths with commas and and", () => {
    expect(formatPathList(["a", "b", "c"])).toBe("`a`, `b` and `c`");
  });

  it("joins four paths the same way", () => {
    expect(formatPathList(["a", "b", "c", "d"])).toBe("`a`, `b`, `c` and `d`");
  });

  it("keeps dotted paths verbatim", () => {
    expect(formatPathList(["address.city", "address.country"])).toBe(
      "`address.city` and `address.country`",
    );
  });
});
