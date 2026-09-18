import type { Severity } from "../rules/types/severity.ts";

import { defaultMessage } from "./default-messages.ts";
import type { Issue } from "./types/issue.ts";

export function scoreIssue(input: {
  path: Array<string | number>;
  severity: Severity;
  outcome: "warning" | "fail";
  ruleId: string;
  score: number;
  confidence: number;
  level: string;
  minConfidence: number;
  model: string;
  message?: string;
  paths?: ReadonlyArray<ReadonlyArray<string | number>>;
}): Issue {
  const issue: Issue = {
    path: input.path,
    code: "semantic",
    severity: input.severity,
    outcome: input.outcome,
    message: input.message ?? defaultMessage(input.outcome, input.ruleId),
    ruleId: input.ruleId,
    score: input.score,
    confidence: input.confidence,
    level: input.level,
    minConfidence: input.minConfidence,
    provider: { model: input.model },
  };
  if (input.paths !== undefined) {
    issue.paths = input.paths.map((path) => [...path]);
  }
  return issue;
}
