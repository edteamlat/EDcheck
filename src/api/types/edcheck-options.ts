import type { FailurePolicy } from "../../policy/types/failure-policy.ts";
import type { Thresholds } from "../../policy/types/thresholds.ts";
import type { SemanticProvider } from "../../providers/types/semantic-provider.ts";

export type EDcheckOptions = {
  provider: SemanticProvider;
  timeoutMs?: number;
  policy?: FailurePolicy;
  thresholds?: Partial<Thresholds>;
};
