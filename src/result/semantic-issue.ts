import type { Thresholds } from "../policy/types/thresholds.ts";
import type { Severity } from "../rules/types/severity.ts";

import { defaultMessage } from "./default-messages.ts";
import type { Issue } from "./types/issue.ts";

export function semanticIssue(input: {
  path: Array<string | number>;
  severity: Severity;
  outcome: "warning" | "fail";
  ruleId: string;
  probability: number;
  thresholds: Thresholds;
  model: string;
  message?: string;
}): Issue {
  const issue: Issue = {
    path: input.path,
    code: "semantic",
    severity: input.severity,
    outcome: input.outcome,
    message: input.message ?? defaultMessage(input.outcome, input.ruleId),
    ruleId: input.ruleId,
    probability: input.probability,
    thresholds: input.thresholds,
    provider: { model: input.model },
  };
  return issue;
}
