import type { GatewayProviderOptions } from "../gateway/types/gateway-provider-options.ts";
import type { TypesafeProviderOptions } from "../typesafe/types/typesafe-provider-options.ts";

import type { ProviderPreference } from "./provider-preference.ts";

export type ProviderFromEnvOptions = {
  env?: Record<string, string | undefined>;
  prefer?: ProviderPreference;
  typesafe?: Omit<TypesafeProviderOptions, "apiKey">;
  gateway?: Omit<GatewayProviderOptions, "apiKey">;
};
