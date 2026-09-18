import type { SemanticProvider } from "../../types/semantic-provider.ts";
import type { SemanticRequest } from "../../types/semantic-request.ts";

export interface MockProvider extends SemanticProvider {
  readonly calls: readonly SemanticRequest[];
}
