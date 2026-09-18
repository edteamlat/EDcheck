import { mapProbabilityToOutcome } from "../policy/map-probability-to-outcome.ts";
import { mapScoreToOutcome } from "../policy/map-score-to-outcome.ts";
import type { Outcome } from "../policy/types/outcome.ts";
import type { Thresholds } from "../policy/types/thresholds.ts";
import type { SemanticAnswer } from "../providers/types/semantic-answer.ts";
import type { SemanticRule } from "../rules/types/semantic-rule.ts";

export function resolveAnswerOutcome(
  item: { rule: SemanticRule; thresholds: Thresholds; minConfidence: number },
  answer: SemanticAnswer | undefined,
): Outcome | undefined {
  if (answer === undefined) {
    return undefined;
  }
  if (item.rule.kind === "score" && answer.type === "score") {
    return mapScoreToOutcome({
      probabilities: answer.probabilities,
      confidence: answer.confidence,
      outcomes: item.rule.levels.map((level) => level.outcome),
      minConfidence: item.minConfidence,
    }).outcome;
  }
  if (answer.type !== "noul") {
    return undefined;
  }
  return mapProbabilityToOutcome(answer.noul, item.thresholds);
}
