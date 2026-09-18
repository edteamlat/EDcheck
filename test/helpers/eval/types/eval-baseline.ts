import type { Calibration } from "../../calibration/types/calibration.ts";
import type { Observation } from "./observation.ts";

export type EvalBaseline = {
  readonly recordedAt: string;
  readonly provider: string;
  readonly model: string;
  readonly observations: readonly Observation[];
  readonly calibration: Calibration;
};
