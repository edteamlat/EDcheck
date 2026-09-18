import { mapProbabilityToOutcome } from "../policy/map-probability-to-outcome.ts";
import { resolveSeverity } from "../policy/resolve-severity.ts";
import type { SemanticResponse } from "../providers/types/semantic-response.ts";
import { semanticIssue } from "../result/semantic-issue.ts";
import type { Issue } from "../result/types/issue.ts";

import type { ExecutableCrossField } from "./collect-executable-cross-fields.ts";
import type { ExecutableRule } from "./collect-executable-rules.ts";

export function mapSemanticIssues(
  rules: readonly ExecutableRule[],
  response: SemanticResponse,
  crossField: readonly ExecutableCrossField[] = [],
): Issue[] {
  const issues: Issue[] = [];
  for (const rule of rules) {
    const issue = issueFromAnswer(rule.ruleId, [...rule.path], rule, response);
    if (issue !== undefined) {
      issues.push(issue);
    }
  }
  for (const binding of crossField) {
    const first = binding.paths[0];
    if (first === undefined) {
      continue;
    }
    const issue = issueFromAnswer(binding.ruleId, [...first], binding, response, binding.paths);
    if (issue !== undefined) {
      issues.push(issue);
    }
  }
  return issues;
}

function issueFromAnswer(
  ruleId: string,
  path: Array<string | number>,
  item: ExecutableRule | ExecutableCrossField,
  response: SemanticResponse,
  paths?: ReadonlyArray<ReadonlyArray<string>>,
): Issue | undefined {
  const answer = response.answers[ruleId];
  if (answer === undefined) {
    return undefined;
  }
  const outcome = mapProbabilityToOutcome(answer.noul, item.thresholds);
  if (outcome === "pass") {
    return undefined;
  }
  return semanticIssue({
    path,
    severity: resolveSeverity(outcome, item.rule.severity),
    outcome,
    ruleId,
    probability: answer.noul,
    thresholds: item.thresholds,
    model: response.model,
    ...(item.rule.message !== undefined ? { message: item.rule.message } : {}),
    ...(paths === undefined ? {} : { paths }),
  });
}
