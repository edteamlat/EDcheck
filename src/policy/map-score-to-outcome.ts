import type { Outcome } from "./types/outcome.ts";
import type { ScoreOutcome } from "./types/score-outcome.ts";

export function mapScoreToOutcome(input: {
  probabilities: readonly number[];
  confidence: number;
  outcomes: readonly Outcome[];
  minConfidence: number;
}): ScoreOutcome {
  let levelIndex = 0;
  let highest = Number.NEGATIVE_INFINITY;
  for (const [index, probability] of input.probabilities.entries()) {
    if (probability !== undefined && probability > highest) {
      highest = probability;
      levelIndex = index;
    }
  }
  const mapped = input.outcomes[levelIndex] ?? "fail";
  const outcome = input.confidence < input.minConfidence ? "warning" : mapped;
  return { levelIndex, outcome };
}
