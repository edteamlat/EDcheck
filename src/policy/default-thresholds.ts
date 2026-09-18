import type { Thresholds } from "./types/thresholds.ts";

export const DEFAULT_THRESHOLDS: Readonly<Thresholds> = Object.freeze({
  pass: 0.7,
  fail: 0.7,
});
