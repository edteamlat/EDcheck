import { describe, expect, it } from "vitest";

import { semantic } from "edcheck";

import { planGroups } from "../../src/compiler/plan-groups.ts";
import type { GroupableRule } from "../../src/compiler/types/groupable-rule.ts";

function rule(id: string, groupKey: string): GroupableRule {
  return {
    dottedPath: id,
    path: [id],
    rule: semantic("x"),
    ruleId: id,
    value: "v",
    effectiveContext: {},
    groupKey,
  };
}

describe("planGroups", () => {
  it("keeps one group when every rule shares the key", () => {
    const groups = planGroups([rule("a", "k"), rule("b", "k")]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.rules.map((item) => item.ruleId)).toEqual(["a", "b"]);
    expect(groups[0]?.crossField).toEqual([]);
  });

  it("orders distinct groups by first declaration", () => {
    const groups = planGroups([rule("a", "k1"), rule("b", "k2"), rule("c", "k1")]);
    expect(groups.map((group) => group.rules.map((item) => item.ruleId))).toEqual([
      ["a", "c"],
      ["b"],
    ]);
  });
});
