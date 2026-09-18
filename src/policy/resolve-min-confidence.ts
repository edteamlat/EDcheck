import { DEFAULT_MIN_CONFIDENCE } from "./default-min-confidence.ts";
import { validateMinConfidence } from "./validate-min-confidence.ts";

export function resolveMinConfidence(layers: {
  rule?: number | undefined;
  schema?: number | undefined;
  instance?: number | undefined;
}): number {
  const value = layers.rule ?? layers.schema ?? layers.instance ?? DEFAULT_MIN_CONFIDENCE;
  validateMinConfidence(value);
  return value;
}
