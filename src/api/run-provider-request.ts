import { compileRequest } from "../compiler/compile-request.ts";
import type { RequestGroup } from "../compiler/types/request-group.ts";
import { EDcheckAbortError } from "../errors/edcheck-abort-error.ts";
import { EDcheckProviderError } from "../errors/edcheck-provider-error.ts";
import type { SemanticProvider } from "../providers/types/semantic-provider.ts";
import type { Issue } from "../result/types/issue.ts";
import { createId } from "../shared/create-id.ts";

import { assertCompleteResponse } from "./assert-complete-response.ts";
import type { ExecutableCrossField } from "./collect-executable-cross-fields.ts";
import type { ExecutableRule } from "./collect-executable-rules.ts";
import { invokeHook } from "./invoke-hook.ts";
import { isTimeoutReason } from "./is-timeout-reason.ts";
import { mapOutcomes } from "./map-outcomes.ts";
import { mapSemanticIssues } from "./map-semantic-issues.ts";
import type { EDcheckHooks } from "./types/edcheck-hooks.ts";
import type { ProviderEventBase } from "./types/provider-event-base.ts";

export async function runProviderRequest(input: {
  group: RequestGroup<ExecutableRule, ExecutableCrossField>;
  provider: SemanticProvider;
  signal: AbortSignal;
  hooks: EDcheckHooks;
  parseId: string;
  requestIndex: number;
  requestCount: number;
  entry: ProviderEventBase["entry"];
  path?: readonly string[];
  callerAborted: () => boolean;
  abortError: () => EDcheckAbortError;
}): Promise<Issue[]> {
  const timestamp = Date.now();
  const start = performance.now();
  const requestId = createId();
  const request = compileRequest(input.group);
  const base: ProviderEventBase = {
    parseId: input.parseId,
    requestId,
    requestIndex: input.requestIndex,
    requestCount: input.requestCount,
    provider: input.provider.name,
    entry: input.entry,
    ruleIds: Object.keys(request.questions),
    timestamp,
    ...(input.path === undefined ? {} : { path: input.path }),
  };
  invokeHook(input.hooks.onRequest, { ...base, request });
  try {
    const response = await input.provider.evaluate(request, { signal: input.signal });
    if (input.callerAborted()) {
      throw input.abortError();
    }
    assertCompleteResponse(response, request.questions);
    invokeHook(input.hooks.onResponse, {
      ...base,
      response,
      outcomes: mapOutcomes(input.group.rules, response, input.group.crossField),
      durationMs: performance.now() - start,
    });
    return mapSemanticIssues(input.group.rules, response, input.group.crossField);
  } catch (error) {
    const durationMs = performance.now() - start;
    if (input.callerAborted() || error instanceof EDcheckAbortError) {
      const abort = error instanceof EDcheckAbortError ? error : input.abortError();
      invokeHook(input.hooks.onError, { ...base, kind: "abort", error: abort, durationMs });
      throw abort;
    }
    if (error instanceof EDcheckProviderError || isTimeoutReason(error)) {
      const providerError =
        error instanceof EDcheckProviderError
          ? error
          : new EDcheckProviderError("timeout", { cause: error });
      invokeHook(input.hooks.onError, {
        ...base,
        kind: "provider",
        error: providerError,
        durationMs,
      });
      throw providerError;
    }
    invokeHook(input.hooks.onError, { ...base, kind: "unexpected", error, durationMs });
    throw error;
  }
}
