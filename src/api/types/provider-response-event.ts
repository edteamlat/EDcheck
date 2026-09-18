import type { Outcome } from "../../policy/types/outcome.ts";
import type { SemanticResponse } from "../../providers/types/semantic-response.ts";

import type { ProviderEventBase } from "./provider-event-base.ts";

export type ProviderResponseEvent = ProviderEventBase & {
  response: SemanticResponse;
  outcomes: Readonly<Record<string, Outcome>>;
  durationMs: number;
};
