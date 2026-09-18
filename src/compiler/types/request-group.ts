import type { EffectiveContext } from "../../context/types/effective-context.ts";

import type { GroupableCrossField } from "./groupable-cross-field.ts";
import type { GroupableRule } from "./groupable-rule.ts";

export type RequestGroup<
  R extends GroupableRule = GroupableRule,
  C extends GroupableCrossField = GroupableCrossField,
> = {
  groupKey: string;
  context: EffectiveContext;
  rules: R[];
  crossField: C[];
};
