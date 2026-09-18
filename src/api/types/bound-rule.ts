import type { ZodType } from "zod";

import type { EffectiveContext } from "../../context/types/effective-context.ts";
import type { Thresholds } from "../../policy/types/thresholds.ts";
import type { SemanticRule } from "../../rules/types/semantic-rule.ts";

export type BoundRule = {
  dottedPath: string;
  path: string[];
  rule: SemanticRule;
  ruleId: string;
  node: ZodType;
  thresholds: Thresholds;
  minConfidence: number;
  effectiveContext: EffectiveContext;
  groupKey: string;
};
