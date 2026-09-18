import type { GroupableCrossField } from "./types/groupable-cross-field.ts";
import type { GroupableRule } from "./types/groupable-rule.ts";
import type { RequestGroup } from "./types/request-group.ts";

export function planGroups<
  R extends GroupableRule,
  C extends GroupableCrossField = GroupableCrossField,
>(rules: readonly R[], crossField: readonly C[] = []): RequestGroup<R, C>[] {
  const fieldByKey = new Map<string, R[]>();
  const crossByKey = new Map<string, C[]>();
  const order: string[] = [];
  const contextByKey = new Map<string, RequestGroup<R, C>["context"]>();

  const remember = (groupKey: string, context: RequestGroup<R, C>["context"]): void => {
    if (!contextByKey.has(groupKey)) {
      order.push(groupKey);
      contextByKey.set(groupKey, context);
    }
  };

  for (const rule of rules) {
    remember(rule.groupKey, rule.effectiveContext);
    const existing = fieldByKey.get(rule.groupKey);
    if (existing === undefined) {
      fieldByKey.set(rule.groupKey, [rule]);
    } else {
      existing.push(rule);
    }
  }
  for (const binding of crossField) {
    remember(binding.groupKey, binding.effectiveContext);
    const existing = crossByKey.get(binding.groupKey);
    if (existing === undefined) {
      crossByKey.set(binding.groupKey, [binding]);
    } else {
      existing.push(binding);
    }
  }

  return order.map((groupKey) => ({
    groupKey,
    context: contextByKey.get(groupKey) ?? {},
    rules: fieldByKey.get(groupKey) ?? [],
    crossField: crossByKey.get(groupKey) ?? [],
  }));
}
