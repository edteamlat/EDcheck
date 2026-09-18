import type { ZodType } from "zod";

import type { Thresholds } from "../../policy/types/thresholds.ts";
import type { SemanticRule } from "../../rules/types/semantic-rule.ts";

export type BoundRule = {
  dottedPath: string;
  path: string[];
  rule: SemanticRule;
  ruleId: string;
  node: ZodType;
  thresholds: Thresholds;
};
