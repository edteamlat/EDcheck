import type { SemanticRule } from "../../rules/types/semantic-rule.ts";

export type CompilableRule = {
  dottedPath: string;
  path: readonly string[];
  rule: SemanticRule;
  ruleId: string;
  value: unknown;
};
