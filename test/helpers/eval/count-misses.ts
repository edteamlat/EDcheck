import { DEFAULT_THRESHOLDS } from "edcheck";

import type { Miss } from "./types/miss.ts";
import type { Observation } from "./types/observation.ts";

export function countMisses(observations: readonly Observation[]): Miss[] {
  const misses: Miss[] = [];
  for (const item of observations) {
    if (item.error !== undefined) {
      misses.push({
        rule: item.rule,
        language: item.language,
        id: item.id,
        expect: item.expect,
        error: item.error,
        ...(item.probability === undefined ? {} : { probability: item.probability }),
      });
      continue;
    }
    if (item.expect === "ambiguous") {
      continue;
    }
    if (typeof item.expect === "object") {
      if (item.level !== item.expect.level) {
        misses.push({
          rule: item.rule,
          language: item.language,
          id: item.id,
          expect: item.expect,
          ...(item.level === undefined ? {} : { level: item.level }),
          ...(item.score === undefined ? {} : { score: item.score }),
          ...(item.confidence === undefined ? {} : { confidence: item.confidence }),
        });
      }
      continue;
    }
    if (item.expect === "positive") {
      if (item.probability === undefined || item.probability < DEFAULT_THRESHOLDS.fail) {
        misses.push({
          rule: item.rule,
          language: item.language,
          id: item.id,
          expect: item.expect,
          band: `p >= ${DEFAULT_THRESHOLDS.fail}`,
          ...(item.probability === undefined ? {} : { probability: item.probability }),
        });
      }
      continue;
    }
    if (item.probability === undefined || item.probability >= DEFAULT_THRESHOLDS.pass) {
      misses.push({
        rule: item.rule,
        language: item.language,
        id: item.id,
        expect: item.expect,
        band: `p < ${DEFAULT_THRESHOLDS.pass}`,
        ...(item.probability === undefined ? {} : { probability: item.probability }),
      });
    }
  }
  return misses;
}
