import type { GroupableRule } from "./types/groupable-rule.ts";
import type { RequestGroup } from "./types/request-group.ts";

export function planGroups<R extends GroupableRule>(rules: readonly R[]): RequestGroup<R>[] {
  const byKey = new Map<string, R[]>();
  const order: string[] = [];
  for (const rule of rules) {
    const existing = byKey.get(rule.groupKey);
    if (existing === undefined) {
      order.push(rule.groupKey);
      byKey.set(rule.groupKey, [rule]);
    } else {
      existing.push(rule);
    }
  }
  return order.map((groupKey) => {
    const groupRules = byKey.get(groupKey) ?? [];
    return {
      groupKey,
      context: groupRules[0]?.effectiveContext ?? {},
      rules: groupRules,
    };
  });
}
