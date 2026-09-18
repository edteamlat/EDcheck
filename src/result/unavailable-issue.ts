import type { Severity } from "../rules/types/severity.ts";

import { defaultMessage } from "./default-messages.ts";
import type { Issue } from "./types/issue.ts";

export function unavailableIssue(input: {
  path: Array<string | number>;
  ruleId: string;
  severity: Severity;
}): Issue {
  return {
    path: input.path,
    code: "semantic_unavailable",
    severity: input.severity,
    message: defaultMessage("unavailable", input.ruleId),
    ruleId: input.ruleId,
  };
}
