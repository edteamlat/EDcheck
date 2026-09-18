import { DEFAULT_THRESHOLDS } from "./default-thresholds.ts";
import type { Thresholds } from "./types/thresholds.ts";
import { validateThresholds } from "./validate-thresholds.ts";

export function resolveThresholds(levels: {
  instance?: Partial<Thresholds> | undefined;
  schema?: Partial<Thresholds> | undefined;
  rule?: Partial<Thresholds> | undefined;
}): Thresholds {
  const resolved: Thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...levels.instance,
    ...levels.schema,
    ...levels.rule,
  };
  validateThresholds(resolved);
  return resolved;
}
