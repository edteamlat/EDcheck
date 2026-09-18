import type { SemanticRequest } from "./semantic-request.ts";
import type { SemanticResponse } from "./semantic-response.ts";

export interface SemanticProvider {
  readonly name: string;
  evaluate(request: SemanticRequest, options: { signal: AbortSignal }): Promise<SemanticResponse>;
}
