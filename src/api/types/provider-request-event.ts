import type { SemanticRequest } from "../../providers/types/semantic-request.ts";

import type { ProviderEventBase } from "./provider-event-base.ts";

export type ProviderRequestEvent = ProviderEventBase & { request: SemanticRequest };
