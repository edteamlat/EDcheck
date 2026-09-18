import { describe, expect, it } from "vitest";

import { ancestorContexts } from "../../src/api/ancestor-contexts.ts";

describe("ancestorContexts", () => {
  it("walks ancestors from the root down and skips missing prefixes", () => {
    expect(
      ancestorContexts(["address", "street", "number"], new Map([
        ["address", { domain: "addr" }],
        ["address.street.number", { purpose: "leaf" }],
      ])),
    ).toEqual([{ domain: "addr" }, { purpose: "leaf" }]);
  });

  it("includes every declared ancestor in root-to-leaf order", () => {
    expect(
      ancestorContexts(["a", "b", "c"], new Map([
        ["a", { notes: ["a"] }],
        ["a.b", { notes: ["b"] }],
      ])),
    ).toEqual([{ notes: ["a"] }, { notes: ["b"] }]);
  });
});
