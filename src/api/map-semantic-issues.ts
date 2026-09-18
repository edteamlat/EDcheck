import { mapProbabilityToOutcome } from "../policy/map-probability-to-outcome.ts";
import { resolveSeverity } from "../policy/resolve-severity.ts";
import type { SemanticResponse } from "../providers/types/semantic-response.ts";
import { semanticIssue } from "../result/semantic-issue.ts";
import type { Issue } from "../result/types/issue.ts";

import type { ExecutableRule } from "./collect-executable-rules.ts";

export function mapSemanticIssues(
  rules: readonly ExecutableRule[],
  response: SemanticResponse,
): Issue[] {
  const issues: Issue[] = [];
  for (const rule of rules) {
    const answer = response.answers[rule.ruleId];
    if (answer === undefined) {
      continue;
    }
    const outcome = mapProbabilityToOutcome(answer.noul, rule.thresholds);
    if (outcome === "pass") {
      continue;
    }
    issues.push(
      semanticIssue({
        path: [...rule.path],
        severity: resolveSeverity(outcome, rule.rule.severity),
        outcome,
        ruleId: rule.ruleId,
        probability: answer.noul,
        thresholds: rule.thresholds,
        model: response.model,
        ...(rule.rule.message !== undefined ? { message: rule.rule.message } : {}),
      }),
    );
  }
  return issues;
}
