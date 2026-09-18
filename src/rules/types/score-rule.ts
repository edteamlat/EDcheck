import type { ContextObject } from "../../context/types/context-object.ts";

import type { ScoreLevel } from "./score-level.ts";
import type { Severity } from "./severity.ts";

export type ScoreRule = {
  readonly kind: "score";
  readonly intent: string;
  readonly severity: Severity;
  readonly levels: readonly ScoreLevel[];
  readonly minConfidence?: number;
  readonly message?: string;
  readonly id?: string;
  readonly context?: ContextObject;
};
