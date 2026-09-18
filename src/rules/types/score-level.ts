import type { Outcome } from "../../policy/types/outcome.ts";

export type ScoreLevel = {
  readonly label: string;
  readonly description: string;
  readonly outcome: Outcome;
};

export type ScoreLevelInput = {
  label: string;
  description?: string;
  outcome: Outcome;
};
