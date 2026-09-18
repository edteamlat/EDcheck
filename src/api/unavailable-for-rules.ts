import type { FailurePolicy } from "../policy/types/failure-policy.ts";
import type { Issue } from "../result/types/issue.ts";
import { unavailableIssue } from "../result/unavailable-issue.ts";

import type { ExecutableRule } from "./collect-executable-rules.ts";

export function unavailableForRules(
  rules: readonly ExecutableRule[],
  policy: FailurePolicy,
): Issue[] {
  const severity = policy === "closed" ? "error" : "warning";
  return rules.map((rule) =>
    unavailableIssue({
      path: [...rule.path],
      ruleId: rule.ruleId,
      severity,
    }),
  );
}
