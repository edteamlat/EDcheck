import type { ProviderErrorKind } from "./provider-error-kind.ts";
import type { ProviderEventBase } from "./provider-event-base.ts";

export type ProviderErrorEvent = ProviderEventBase & {
  kind: ProviderErrorKind;
  error: unknown;
  durationMs: number;
};
