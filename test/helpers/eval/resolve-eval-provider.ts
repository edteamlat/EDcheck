import { providerFromEnv, type ProviderPreference, type SemanticProvider } from "edcheck";

export function resolveEvalProvider(env: NodeJS.ProcessEnv = process.env): SemanticProvider {
  const forced = env.EDCHECK_EVAL_PROVIDER;
  if (forced === "typesafe" || forced === "gateway") {
    const prefer: ProviderPreference = forced;
    return providerFromEnv({ env, prefer });
  }
  return providerFromEnv({ env });
}
