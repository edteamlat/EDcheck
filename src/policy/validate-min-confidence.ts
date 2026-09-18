import { EDcheckConfigError } from "../errors/edcheck-config-error.ts";

export function validateMinConfidence(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new EDcheckConfigError(
      "minConfidence must be a number in [0, 1].",
      "invalid_confidence",
    );
  }
}
