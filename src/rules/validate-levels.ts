import { EDcheckConfigError } from "../errors/edcheck-config-error.ts";
import type { Outcome } from "../policy/types/outcome.ts";

import type { ScoreLevel, ScoreLevelInput } from "./types/score-level.ts";

const OUTCOMES = new Set<Outcome>(["pass", "warning", "fail"]);

export function validateLevels(levels: readonly ScoreLevelInput[]): ScoreLevel[] {
  if (levels.length < 2) {
    throw new EDcheckConfigError("Score rules require at least two levels.", "invalid_rule");
  }
  const seen = new Set<string>();
  const normalized: ScoreLevel[] = [];
  for (const level of levels) {
    if (level.outcome === undefined) {
      throw new EDcheckConfigError("Each score level requires an outcome.", "invalid_rule");
    }
    if (!OUTCOMES.has(level.outcome)) {
      throw new EDcheckConfigError(
        `Unknown level outcome "${String(level.outcome)}".`,
        "invalid_option",
      );
    }
    const label = level.label.trim();
    if (label.length === 0) {
      throw new EDcheckConfigError("Score level labels must be non-empty.", "invalid_rule");
    }
    if (seen.has(label)) {
      throw new EDcheckConfigError(`Duplicate score level label "${label}".`, "invalid_rule");
    }
    seen.add(label);
    const description = (level.description ?? level.label).trim();
    if (description.length === 0) {
      throw new EDcheckConfigError(
        "Score level descriptions must be non-empty.",
        "invalid_rule",
      );
    }
    normalized.push(
      Object.freeze({
        label: level.label,
        description: level.description ?? level.label,
        outcome: level.outcome,
      }),
    );
  }
  return normalized;
}
