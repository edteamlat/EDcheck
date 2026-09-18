import type { Context } from "../../context/types/context.ts";

import type { ScoreLevelInput } from "./score-level.ts";
import type { Severity } from "./severity.ts";

export type ScoreRuleOptions = {
  kind: "score";
  intent: string;
  levels: readonly [ScoreLevelInput, ScoreLevelInput, ...ScoreLevelInput[]];
  minConfidence?: number;
  severity?: Severity;
  message?: string;
  id?: string;
  context?: Context;
};
