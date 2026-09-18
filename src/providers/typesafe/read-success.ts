import { EDcheckProviderError } from "../../errors/edcheck-provider-error.ts";
import type { SemanticRequest } from "../types/semantic-request.ts";
import type { SemanticResponse } from "../types/semantic-response.ts";

import { mapTypesafeResponse } from "./map-response.ts";
import { typesafeResponseSchema } from "./response-schema.ts";

export async function readTypesafeSuccess(
  response: Response,
  request: SemanticRequest,
): Promise<SemanticResponse> {
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new EDcheckProviderError("malformed_response");
  }
  const parsed = typesafeResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new EDcheckProviderError("malformed_response");
  }
  for (const id of Object.keys(request.questions)) {
    if (parsed.data.answers[id] === undefined) {
      throw new EDcheckProviderError("malformed_response");
    }
  }
  return mapTypesafeResponse(parsed.data, request);
}
