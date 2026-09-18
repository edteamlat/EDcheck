import { EDcheckProviderError } from "../errors/edcheck-provider-error.ts";
import type { SemanticQuestion } from "../providers/types/semantic-question.ts";
import type { SemanticResponse } from "../providers/types/semantic-response.ts";

function isUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function assertCompleteResponse(
  response: SemanticResponse,
  questions: Record<string, SemanticQuestion>,
): void {
  for (const [id, question] of Object.entries(questions)) {
    const answer = response.answers[id];
    if (answer === undefined || answer.type !== question.type) {
      throw new EDcheckProviderError("malformed_response", {
        message: `Provider response is missing a valid answer for "${id}".`,
      });
    }
    if (question.type === "noul" && answer.type === "noul") {
      if (!isUnitInterval(answer.noul)) {
        throw new EDcheckProviderError("malformed_response", {
          message: `Provider response is missing a valid noul answer for "${id}".`,
        });
      }
      continue;
    }
    if (question.type !== "score" || answer.type !== "score") {
      throw new EDcheckProviderError("malformed_response", {
        message: `Provider response is missing a valid answer for "${id}".`,
      });
    }
    if (
      answer.probabilities.length !== question.criteria.length ||
      !answer.probabilities.every(isUnitInterval) ||
      !isUnitInterval(answer.confidence) ||
      !Number.isFinite(answer.score)
    ) {
      throw new EDcheckProviderError("malformed_response", {
        message: `Provider response is missing a valid score answer for "${id}".`,
      });
    }
  }
}
