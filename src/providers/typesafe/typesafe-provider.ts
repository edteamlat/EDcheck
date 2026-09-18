import { EDcheckConfigError } from "../../errors/edcheck-config-error.ts";
import { EDcheckProviderError } from "../../errors/edcheck-provider-error.ts";
import { delayUntil } from "../../shared/delay-until.ts";
import type { SemanticProvider } from "../types/semantic-provider.ts";
import type { SemanticRequest } from "../types/semantic-request.ts";
import type { SemanticResponse } from "../types/semantic-response.ts";

import { readTypesafeSuccess } from "./read-success.ts";
import { shouldRetry } from "./should-retry.ts";
import type { TypesafeProviderOptions } from "./types/typesafe-provider-options.ts";

const DEFAULT_BASE_URL = "https://api.typesafe.ai";
const DEFAULT_MODEL = "jev-latest";
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 250;

export function typesafeProvider(options: TypesafeProviderOptions): SemanticProvider {
  if (options.apiKey.trim().length === 0) {
    throw new EDcheckConfigError("apiKey is required.", "invalid_provider_options");
  }
  const fetchFn = options.fetch ?? globalThis.fetch;
  const model = options.model ?? DEFAULT_MODEL;
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const retries = options.retries ?? DEFAULT_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  return {
    name: "typesafe",
    async evaluate(
      request: SemanticRequest,
      evaluateOptions: { signal: AbortSignal },
    ): Promise<SemanticResponse> {
      const url = `${baseUrl}/v1/systemone`;
      const body = JSON.stringify({
        state: request.state,
        model,
        questions: request.questions,
      });
      const maxAttempts = retries + 1;
      let attempt = 0;
      while (attempt < maxAttempts) {
        if (evaluateOptions.signal.aborted) {
          throw evaluateOptions.signal.reason;
        }
        try {
          const response = await fetchFn(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${options.apiKey}`,
              "Content-Type": "application/json",
            },
            body,
            signal: evaluateOptions.signal,
          });
          if (response.ok) {
            return await readTypesafeSuccess(response, request);
          }
          if (shouldRetry(response.status) && attempt < retries) {
            attempt += 1;
            await delayUntil(retryDelayMs * 2 ** (attempt - 1), evaluateOptions.signal);
            continue;
          }
          throw new EDcheckProviderError("http", {
            status: response.status,
            retryable: shouldRetry(response.status),
          });
        } catch (error) {
          if (evaluateOptions.signal.aborted) {
            throw evaluateOptions.signal.reason;
          }
          if (error instanceof EDcheckProviderError) {
            throw error;
          }
          throw new EDcheckProviderError("network", {
            retryable: false,
            cause: error,
          });
        }
      }
      throw new EDcheckProviderError("http", { retryable: true });
    },
  };
}
