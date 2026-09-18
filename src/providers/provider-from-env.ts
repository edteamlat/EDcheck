import { EDcheckConfigError } from "../errors/edcheck-config-error.ts";

import { gatewayProvider } from "./gateway/gateway-provider.ts";
import { typesafeProvider } from "./typesafe/typesafe-provider.ts";
import type { SemanticProvider } from "./types/semantic-provider.ts";
import type { ProviderFromEnvOptions } from "./types/provider-from-env-options.ts";
import type { ProviderPreference } from "./types/provider-preference.ts";

const PREFERENCES = new Set<ProviderPreference>(["typesafe", "gateway"]);

function readKey(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

export function providerFromEnv(options: ProviderFromEnvOptions = {}): SemanticProvider {
  const prefer = options.prefer ?? "typesafe";
  if (!PREFERENCES.has(prefer)) {
    throw new EDcheckConfigError(
      `Unknown prefer "${String(options.prefer)}".`,
      "invalid_option",
    );
  }
  const env = options.env ?? process.env;
  const typesafeKey = readKey(env.TYPESAFE_API_KEY);
  const gatewayKey = readKey(env.AI_GATEWAY_API_KEY);
  if (prefer === "gateway" && gatewayKey !== undefined) {
    return gatewayProvider({
      apiKey: gatewayKey,
      ...(options.gateway ?? {}),
    });
  }
  if (typesafeKey !== undefined) {
    return typesafeProvider({
      apiKey: typesafeKey,
      ...(options.typesafe ?? {}),
    });
  }
  if (gatewayKey !== undefined) {
    return gatewayProvider({
      apiKey: gatewayKey,
      ...(options.gateway ?? {}),
    });
  }
  throw new EDcheckConfigError(
    "Missing API key. Set TYPESAFE_API_KEY or AI_GATEWAY_API_KEY.",
    "missing_api_key",
  );
}
