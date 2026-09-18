import type { Thresholds } from "../../policy/types/thresholds.ts";
import type { Severity } from "../../rules/types/severity.ts";

import type { IssueProvider } from "./issue-provider.ts";

export type Issue = {
  path: Array<string | number>;
  code: string;
  severity: Severity;
  message: string;
  outcome?: "warning" | "fail";
  ruleId?: string;
  probability?: number;
  score?: number;
  confidence?: number;
  level?: string;
  minConfidence?: number;
  thresholds?: Thresholds;
  provider?: IssueProvider;
  paths?: Array<Array<string | number>>;
};
