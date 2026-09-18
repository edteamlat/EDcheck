import type { Thresholds } from "../../policy/types/thresholds.ts";
import type { Severity } from "./severity.ts";

export type SemanticRule = {
  readonly kind: "noul";
  readonly intent: string;
  readonly severity: Severity;
  readonly valid?: string;
  readonly invalid?: string;
  readonly thresholds?: Partial<Thresholds>;
  readonly message?: string;
  readonly id?: string;
};
