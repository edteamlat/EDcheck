import { EDcheckConfigError } from "../../errors/edcheck-config-error.ts";
import { EDcheckProviderError } from "../../errors/edcheck-provider-error.ts";

import type { AiSdkModule } from "./types/ai-sdk-module.ts";

function readHttpShape(error: unknown): { status: number; retryable: boolean } | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const record = error as { statusCode?: unknown; isRetryable?: unknown };
  if (typeof record.statusCode !== "number") {
    return undefined;
  }
  return {
    status: record.statusCode,
    retryable: typeof record.isRetryable === "boolean" ? record.isRetryable : false,
  };
}

export function mapSdkError(
  error: unknown,
  signal: AbortSignal,
  ai: AiSdkModule,
): never {
  if (signal.aborted) {
    throw signal.reason;
  }
  if (ai.Experimental_EvaluationUnsupportedQuestionTypeError.isInstance(error)) {
    throw new EDcheckConfigError(
      "The evaluation model does not support this question type.",
      "unsupported_question_type",
    );
  }
  if (ai.InvalidArgumentError.isInstance(error)) {
    throw new EDcheckConfigError(
      error instanceof Error ? error.message : "Invalid provider argument.",
      "invalid_provider_options",
    );
  }
  const apiError = ai.APICallError.isInstance(error)
    ? error
    : typeof error === "object" &&
        error !== null &&
        "cause" in error &&
        ai.APICallError.isInstance((error as { cause: unknown }).cause)
      ? (error as { cause: unknown }).cause
      : undefined;
  if (apiError !== undefined && ai.APICallError.isInstance(apiError)) {
    if (apiError.statusCode !== undefined) {
      throw new EDcheckProviderError("http", {
        status: apiError.statusCode,
        retryable: apiError.isRetryable,
        cause: error,
      });
    }
    throw new EDcheckProviderError("network", { retryable: false, cause: error });
  }
  const http = readHttpShape(error);
  if (http !== undefined) {
    throw new EDcheckProviderError("http", {
      status: http.status,
      retryable: http.retryable,
      cause: error,
    });
  }
  if (ai.InvalidResponseDataError.isInstance(error)) {
    throw new EDcheckProviderError("malformed_response", { cause: error });
  }
  throw new EDcheckProviderError("sdk", { retryable: false, cause: error });
}
