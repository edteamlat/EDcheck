import type { z } from "zod";

import { EDcheckProviderError } from "../../errors/edcheck-provider-error.ts";
import type { SemanticAnswer } from "../types/semantic-answer.ts";
import type { SemanticRequest } from "../types/semantic-request.ts";
import type { SemanticResponse } from "../types/semantic-response.ts";

import type { typesafeResponseSchema } from "./response-schema.ts";

type TypesafeRawResponse = z.output<typeof typesafeResponseSchema>;

function isUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function mapTypesafeResponse(
  raw: TypesafeRawResponse,
  request: SemanticRequest,
): SemanticResponse {
  const answers: Record<string, SemanticAnswer> = {};
  for (const [id, question] of Object.entries(request.questions)) {
    const rawAnswer = raw.answers[id];
    if (rawAnswer === undefined || rawAnswer.type !== question.type) {
      throw new EDcheckProviderError("malformed_response");
    }
    if (question.type === "noul" && rawAnswer.type === "noul") {
      answers[id] = rawAnswer;
      continue;
    }
    if (question.type !== "score" || rawAnswer.type !== "score") {
      throw new EDcheckProviderError("malformed_response");
    }
    const length = question.criteria.length;
    const probabilities: number[] = [];
    for (let index = 0; index < length; index += 1) {
      const value = rawAnswer.probabilities[String(index)];
      if (value === undefined || !isUnitInterval(value)) {
        throw new EDcheckProviderError("malformed_response");
      }
      probabilities.push(value);
    }
    if (Object.keys(rawAnswer.probabilities).length !== length) {
      throw new EDcheckProviderError("malformed_response");
    }
    answers[id] = {
      type: "score",
      score: rawAnswer.score,
      probabilities,
      confidence: rawAnswer.confidence,
    };
  }
  const response: SemanticResponse = {
    model: raw.model,
    answers,
  };
  if (raw.usage !== undefined) {
    response.usage = {
      inputTokens: raw.usage.input_tokens,
      outputTokens: raw.usage.output_tokens,
    };
  }
  return response;
}
