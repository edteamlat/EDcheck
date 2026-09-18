import type { ZodType } from "zod";

import type { EffectiveContext } from "../../context/types/effective-context.ts";
import type { Thresholds } from "../../policy/types/thresholds.ts";
import type { SemanticRule } from "../../rules/types/semantic-rule.ts";

export type BoundCrossField = {
  dottedPaths: string[];
  paths: string[][];
  nodes: ZodType[];
  rule: SemanticRule;
  ruleId: string;
  thresholds: Thresholds;
  minConfidence: number;
  effectiveContext: EffectiveContext;
  groupKey: string;
};
