import type { FailurePolicy } from "../policy/types/failure-policy.ts";
import type { Issue } from "../result/types/issue.ts";
import { unavailableIssue } from "../result/unavailable-issue.ts";

import type { ExecutableCrossField } from "./collect-executable-cross-fields.ts";
import type { ExecutableRule } from "./collect-executable-rules.ts";

export function unavailableForRules(
  rules: readonly ExecutableRule[],
  policy: FailurePolicy,
  crossField: readonly ExecutableCrossField[] = [],
): Issue[] {
  const severity = policy === "closed" ? "error" : "warning";
  const issues: Issue[] = rules.map((rule) =>
    unavailableIssue({
      path: [...rule.path],
      ruleId: rule.ruleId,
      severity,
    }),
  );
  for (const binding of crossField) {
    const first = binding.paths[0];
    if (first === undefined) {
      continue;
    }
    issues.push(
      unavailableIssue({
        path: [...first],
        ruleId: binding.ruleId,
        severity,
        paths: binding.paths,
      }),
    );
  }
  return issues;
}
