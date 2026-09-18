import type { EffectiveContext } from "../../context/types/effective-context.ts";

import type { GroupableRule } from "./groupable-rule.ts";

export type RequestGroup<R extends GroupableRule = GroupableRule> = {
  groupKey: string;
  context: EffectiveContext;
  rules: R[];
};
