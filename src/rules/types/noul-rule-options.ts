import type { Context } from "../../context/types/context.ts";
import type { Thresholds } from "../../policy/types/thresholds.ts";

import type { Severity } from "./severity.ts";

export type NoulRuleOptions = {
  kind?: "noul";
  intent: string;
  valid?: string;
  invalid?: string;
  thresholds?: Partial<Thresholds>;
  severity?: Severity;
  message?: string;
  id?: string;
  context?: Context;
};
