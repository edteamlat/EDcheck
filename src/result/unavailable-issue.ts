import type { Severity } from "../rules/types/severity.ts";

import { defaultMessage } from "./default-messages.ts";
import type { Issue } from "./types/issue.ts";

export function unavailableIssue(input: {
  path: Array<string | number>;
  ruleId: string;
  severity: Severity;
  paths?: ReadonlyArray<ReadonlyArray<string | number>>;
}): Issue {
  const issue: Issue = {
    path: input.path,
    code: "semantic_unavailable",
    severity: input.severity,
    message: defaultMessage("unavailable", input.ruleId),
    ruleId: input.ruleId,
  };
  if (input.paths !== undefined) {
    issue.paths = input.paths.map((path) => [...path]);
  }
  return issue;
}
