import { describe, expect, it } from "vitest";

import { extractBacktickReferences } from "../../src/rules/extract-backtick-references.ts";

describe("extractBacktickReferences", () => {
  it("returns path-like tokens in order of appearance", () => {
    expect(
      extractBacktickReferences("Compare `age` with `address.city`, `$id` and `_x`"),
    ).toEqual(["age", "address.city", "$id", "_x"]);
  });

  it("ignores non-path-like backticks", () => {
    expect(
      extractBacktickReferences("Values like `N/A`, `senior engineer` and `15 years`"),
    ).toEqual([]);
  });

  it("ignores empty backticks", () => {
    expect(extractBacktickReferences("Nothing `` here")).toEqual([]);
  });

  it("deduplicates repeated tokens", () => {
    expect(extractBacktickReferences("`age` then `occupation` then `age`")).toEqual([
      "age",
      "occupation",
    ]);
  });

  it("returns an empty list when there are no backticks", () => {
    expect(extractBacktickReferences("No references")).toEqual([]);
  });

  it("yields no token for an unbalanced backtick", () => {
    expect(extractBacktickReferences("Broken `age")).toEqual([]);
  });
});
