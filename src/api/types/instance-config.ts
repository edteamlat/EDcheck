import type { ContextObject } from "../../context/types/context-object.ts";
import type { FailurePolicy } from "../../policy/types/failure-policy.ts";
import type { Thresholds } from "../../policy/types/thresholds.ts";
import type { SemanticProvider } from "../../providers/types/semantic-provider.ts";

import type { EDcheckHooks } from "./edcheck-hooks.ts";

export type InstanceConfig = {
  provider: SemanticProvider;
  timeoutMs: number;
  policy: FailurePolicy;
  thresholds: Partial<Thresholds>;
  minConfidence?: number;
  context: ContextObject;
  hooks: EDcheckHooks;
};
