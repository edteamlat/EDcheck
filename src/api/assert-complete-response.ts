import { EDcheckProviderError } from "../errors/edcheck-provider-error.ts";
import type { SemanticResponse } from "../providers/types/semantic-response.ts";

function isUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function assertCompleteResponse(
  response: SemanticResponse,
  questionIds: readonly string[],
): void {
  for (const id of questionIds) {
    const answer = response.answers[id];
    if (
      answer === undefined ||
      answer.type !== "noul" ||
      !isUnitInterval(answer.noul)
    ) {
      throw new EDcheckProviderError("malformed_response", {
        message: `Provider response is missing a valid noul answer for "${id}".`,
      });
    }
  }
}
