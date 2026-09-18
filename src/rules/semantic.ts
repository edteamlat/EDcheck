import { normalizeRule } from "./normalize-rule.ts";
import type { SemanticRule } from "./types/semantic-rule.ts";
import type { SemanticRuleOptions } from "./types/semantic-rule-options.ts";

export function semantic(statementOrOptions: string | SemanticRuleOptions): SemanticRule {
  if (typeof statementOrOptions === "string") {
    return normalizeRule({ intent: statementOrOptions });
  }
  return normalizeRule(statementOrOptions);
}
