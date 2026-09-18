import { EDcheckConfigError } from "../errors/edcheck-config-error.ts";

import type { Thresholds } from "./types/thresholds.ts";

function isUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateThresholds(thresholds: Partial<Thresholds>): void {
  const { pass, fail } = thresholds;
  if (pass !== undefined && !isUnitInterval(pass)) {
    throw new EDcheckConfigError(
      "Thresholds must be numbers in the closed interval [0, 1].",
      "invalid_thresholds",
    );
  }
  if (fail !== undefined && !isUnitInterval(fail)) {
    throw new EDcheckConfigError(
      "Thresholds must be numbers in the closed interval [0, 1].",
      "invalid_thresholds",
    );
  }
  if (pass !== undefined && fail !== undefined && fail > pass) {
    throw new EDcheckConfigError(
      "The fail threshold must not be greater than the pass threshold.",
      "invalid_thresholds",
    );
  }
}
