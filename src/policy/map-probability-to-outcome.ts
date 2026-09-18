import type { Outcome } from "./types/outcome.ts";
import type { Thresholds } from "./types/thresholds.ts";

export function mapProbabilityToOutcome(probability: number, thresholds: Thresholds): Outcome {
  if (probability >= thresholds.pass) {
    return "pass";
  }
  if (probability >= thresholds.fail) {
    return "warning";
  }
  return "fail";
}
