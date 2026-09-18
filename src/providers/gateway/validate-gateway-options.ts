import { EDcheckConfigError } from "../../errors/edcheck-config-error.ts";

import type { GatewayProviderOptions } from "./types/gateway-provider-options.ts";

export function validateGatewayOptions(options: GatewayProviderOptions): void {
  if (options.apiKey !== undefined && options.apiKey.trim().length === 0) {
    throw new EDcheckConfigError(
      "apiKey must be a non-empty string when provided.",
      "invalid_provider_options",
    );
  }
  if (
    options.maxRetries !== undefined &&
    (!Number.isInteger(options.maxRetries) || options.maxRetries < 0)
  ) {
    throw new EDcheckConfigError(
      "maxRetries must be a non-negative integer.",
      "invalid_provider_options",
    );
  }
}
