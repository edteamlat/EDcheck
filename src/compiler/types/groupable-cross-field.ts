import type { EffectiveContext } from "../../context/types/effective-context.ts";
import type { SemanticRule } from "../../rules/types/semantic-rule.ts";

export type GroupableCrossField = {
  groupKey: string;
  effectiveContext: EffectiveContext;
  rule: SemanticRule;
  ruleId: string;
  dottedPaths: readonly string[];
  paths: readonly (readonly string[])[];
  values: readonly unknown[];
};
