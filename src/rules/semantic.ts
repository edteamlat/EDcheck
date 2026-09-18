import { normalizeRule } from "./normalize-rule.ts";
import type { NoulRule } from "./types/noul-rule.ts";
import type { NoulRuleOptions } from "./types/noul-rule-options.ts";
import type { ScoreRule } from "./types/score-rule.ts";
import type { ScoreRuleOptions } from "./types/score-rule-options.ts";
import type { SemanticRule } from "./types/semantic-rule.ts";
import type { SemanticRuleOptions } from "./types/semantic-rule-options.ts";

export function semantic(statement: string): NoulRule;
export function semantic(options: NoulRuleOptions): NoulRule;
export function semantic(options: ScoreRuleOptions): ScoreRule;
export function semantic(statementOrOptions: string | SemanticRuleOptions): SemanticRule {
  if (typeof statementOrOptions === "string") {
    return normalizeRule({ intent: statementOrOptions });
  }
  return normalizeRule(statementOrOptions);
}
