import { EDcheckProviderError } from "../../errors/edcheck-provider-error.ts";
import { isUnitInterval } from "../shared/is-unit-interval.ts";
import type { SemanticAnswer } from "../types/semantic-answer.ts";
import type { SemanticQuestion } from "../types/semantic-question.ts";
import type { SemanticRequest } from "../types/semantic-request.ts";
import type { SemanticResponse } from "../types/semantic-response.ts";

type GatewayEvaluateResult = {
  answers: Record<string, { type: string; probability?: number; score?: number; probabilities?: Record<string, number> }>;
  usage?: { inputTokens?: number | undefined; outputTokens?: number | undefined };
  providerMetadata?: Record<string, unknown> | undefined;
  response?: { modelId?: string } | undefined;
};

function readConfidence(metadata: unknown, id: string): number | undefined {
  if (typeof metadata !== "object" || metadata === null) {
    return undefined;
  }
  const typesafe = (metadata as { typesafe?: unknown }).typesafe;
  if (typeof typesafe !== "object" || typesafe === null) {
    return undefined;
  }
  const confidence = (typesafe as { confidence?: unknown }).confidence;
  if (typeof confidence !== "object" || confidence === null) {
    return undefined;
  }
  const value = (confidence as Record<string, unknown>)[id];
  return typeof value === "number" ? value : undefined;
}

function mapScoreProbabilities(
  raw: Record<string, number> | undefined,
  length: number,
): number[] {
  if (raw === undefined) {
    throw new EDcheckProviderError("malformed_response");
  }
  const probabilities: number[] = [];
  for (let index = 0; index < length; index += 1) {
    const value = raw[String(index)];
    if (value === undefined || !isUnitInterval(value)) {
      throw new EDcheckProviderError("malformed_response");
    }
    probabilities.push(value);
  }
  if (Object.keys(raw).length !== length) {
    throw new EDcheckProviderError("malformed_response");
  }
  return probabilities;
}

export function fromGatewayAnswers(
  result: GatewayEvaluateResult,
  request: SemanticRequest,
  fallbackModel: string,
): SemanticResponse {
  const answers: Record<string, SemanticAnswer> = {};
  for (const [id, question] of Object.entries(request.questions) as Array<
    [string, SemanticQuestion]
  >) {
    const raw = result.answers[id];
    if (raw === undefined) {
      throw new EDcheckProviderError("malformed_response");
    }
    if (question.type === "noul") {
      if (
        raw.type !== "boolean" ||
        typeof raw.probability !== "number" ||
        !isUnitInterval(raw.probability)
      ) {
        throw new EDcheckProviderError("malformed_response");
      }
      answers[id] = { type: "noul", noul: raw.probability };
      continue;
    }
    const confidence = readConfidence(result.providerMetadata, id);
    if (
      raw.type !== "score" ||
      typeof raw.score !== "number" ||
      !Number.isFinite(raw.score) ||
      confidence === undefined ||
      !isUnitInterval(confidence)
    ) {
      throw new EDcheckProviderError("malformed_response");
    }
    answers[id] = {
      type: "score",
      score: raw.score,
      probabilities: mapScoreProbabilities(raw.probabilities, question.criteria.length),
      confidence,
    };
  }
  const response: SemanticResponse = {
    model: result.response?.modelId ?? fallbackModel,
    answers,
  };
  if (
    typeof result.usage?.inputTokens === "number" &&
    typeof result.usage.outputTokens === "number"
  ) {
    response.usage = {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    };
  }
  return response;
}
