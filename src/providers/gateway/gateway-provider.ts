import type { Experimental_EvaluationModel } from "ai";

import { EDcheckConfigError } from "../../errors/edcheck-config-error.ts";
import { EDcheckProviderError } from "../../errors/edcheck-provider-error.ts";
import type { SemanticProvider } from "../types/semantic-provider.ts";
import type { SemanticRequest } from "../types/semantic-request.ts";
import type { SemanticResponse } from "../types/semantic-response.ts";

import { defaultImportModule } from "./default-import-module.ts";
import { fromGatewayAnswers } from "./from-gateway-answers.ts";
import { loadAiSdk } from "./load-ai-sdk.ts";
import { mapSdkError } from "./map-sdk-error.ts";
import { resolveEvaluationModel } from "./resolve-evaluation-model.ts";
import { toGatewayQuestions } from "./to-gateway-questions.ts";
import type { GatewayProviderInternals } from "./types/gateway-provider-internals.ts";
import type { GatewayProviderOptions } from "./types/gateway-provider-options.ts";
import { validateGatewayOptions } from "./validate-gateway-options.ts";

const DEFAULT_MODEL = "typesafe-ai/jev";
const DEFAULT_MAX_RETRIES = 2;

export function gatewayProvider(
  options: GatewayProviderOptions = {},
  internals: GatewayProviderInternals = {},
): SemanticProvider {
  validateGatewayOptions(options);
  const importModule = internals.importModule ?? defaultImportModule;
  const configuredModel = options.model ?? DEFAULT_MODEL;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const modelCache: { instance?: Experimental_EvaluationModel } = {};
  const fallbackModel = typeof configuredModel === "string" ? configuredModel : DEFAULT_MODEL;

  return {
    name: "gateway",
    async evaluate(
      request: SemanticRequest,
      evaluateOptions: { signal: AbortSignal },
    ): Promise<SemanticResponse> {
      const ai = await loadAiSdk(importModule);
      const model = await resolveEvaluationModel({
        model: configuredModel,
        ...(options.apiKey === undefined ? {} : { apiKey: options.apiKey }),
        ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
        importModule,
        cache: modelCache,
      });
      try {
        const result = await ai.experimental_evaluate({
          model,
          state: request.state as Parameters<typeof ai.experimental_evaluate>[0]["state"],
          questions: toGatewayQuestions(request.questions),
          abortSignal: evaluateOptions.signal,
          maxRetries,
        });
        return fromGatewayAnswers(result, request, fallbackModel);
      } catch (error) {
        if (error instanceof EDcheckProviderError || error instanceof EDcheckConfigError) {
          throw error;
        }
        mapSdkError(error, evaluateOptions.signal, ai);
      }
    },
  };
}
