import type { ProviderErrorEvent } from "./provider-error-event.ts";
import type { ProviderRequestEvent } from "./provider-request-event.ts";
import type { ProviderResponseEvent } from "./provider-response-event.ts";

export type EDcheckHooks = {
  onRequest?: (event: ProviderRequestEvent) => void | Promise<void>;
  onResponse?: (event: ProviderResponseEvent) => void | Promise<void>;
  onError?: (event: ProviderErrorEvent) => void | Promise<void>;
};
