import type { EffectiveContext } from "../../context/types/effective-context.ts";

import type { CompilableRule } from "./compilable-rule.ts";

export type GroupableRule = CompilableRule & {
  groupKey: string;
  effectiveContext: EffectiveContext;
};
