import type { SemanticResponse } from "../types/semantic-response.ts";

import type { typesafeResponseSchema } from "./response-schema.ts";
import type { z } from "zod";

type TypesafeRawResponse = z.output<typeof typesafeResponseSchema>;

export function mapTypesafeResponse(raw: TypesafeRawResponse): SemanticResponse {
  const response: SemanticResponse = {
    model: raw.model,
    answers: raw.answers,
  };
  if (raw.usage !== undefined) {
    response.usage = {
      inputTokens: raw.usage.input_tokens,
      outputTokens: raw.usage.output_tokens,
    };
  }
  return response;
}
