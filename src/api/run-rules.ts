import { planGroups } from "../compiler/plan-groups.ts";
import { EDcheckAbortError } from "../errors/edcheck-abort-error.ts";
import { EDcheckProviderError } from "../errors/edcheck-provider-error.ts";
import type { FailurePolicy } from "../policy/types/failure-policy.ts";
import type { SemanticProvider } from "../providers/types/semantic-provider.ts";
import { assembleResult } from "../result/assemble-result.ts";
import type { Issue } from "../result/types/issue.ts";
import type { SemanticResult } from "../result/types/semantic-result.ts";
import { combineSignals } from "../shared/combine-signals.ts";
import { createId } from "../shared/create-id.ts";

import type { ExecutableCrossField } from "./collect-executable-cross-fields.ts";
import { isTimeoutReason } from "./is-timeout-reason.ts";
import { runProviderRequest } from "./run-provider-request.ts";
import { toAbortError } from "./to-abort-error.ts";
import type { BoundRuleWithValue } from "./types/bound-rule-with-value.ts";
import type { EDcheckHooks } from "./types/edcheck-hooks.ts";
import type { ProviderEventBase } from "./types/provider-event-base.ts";
import { unavailableForRules } from "./unavailable-for-rules.ts";

export async function runRules<T>(input: {
  rules: readonly BoundRuleWithValue[];
  crossField?: readonly ExecutableCrossField[];
  data: T | undefined;
  zodIssues: readonly Issue[];
  provider: SemanticProvider;
  timeoutMs: number;
  policy: FailurePolicy;
  hooks: EDcheckHooks;
  signal?: AbortSignal | undefined;
  entry?: ProviderEventBase["entry"];
  path?: readonly string[];
}): Promise<SemanticResult<T>> {
  if (input.signal?.aborted) {
    throw toAbortError(input.signal.reason);
  }
  const executableCross = input.crossField ?? [];
  if (input.rules.length === 0 && executableCross.length === 0) {
    return assembleResult(input.data, input.zodIssues, []);
  }

  const groups = planGroups(input.rules, executableCross);
  const signals = input.signal === undefined ? [] : [input.signal];
  const combined = combineSignals(signals, { timeoutMs: input.timeoutMs });
  const parseId = createId();
  let cachedAbort: EDcheckAbortError | undefined;
  const abortError = (): EDcheckAbortError => {
    cachedAbort ??= toAbortError(input.signal?.reason);
    return cachedAbort;
  };
  try {
    const settled = await Promise.allSettled(
      groups.map((group, requestIndex) =>
        runProviderRequest({
          group,
          provider: input.provider,
          signal: combined.signal,
          hooks: input.hooks,
          parseId,
          requestIndex,
          requestCount: groups.length,
          entry: input.entry ?? "object",
          ...(input.path === undefined ? {} : { path: input.path }),
          callerAborted: () => input.signal?.aborted === true,
          abortError,
        }),
      ),
    );
    if (input.signal?.aborted) {
      throw abortError();
    }
    const semanticIssues: Issue[] = [];
    for (const [index, result] of settled.entries()) {
      if (result.status === "fulfilled") {
        semanticIssues.push(...result.value);
        continue;
      }
      const error = result.reason;
      if (input.signal?.aborted) {
        throw abortError();
      }
      if (error instanceof EDcheckAbortError) {
        throw error;
      }
      if (error instanceof EDcheckProviderError || isTimeoutReason(error)) {
        const group = groups[index];
        if (group !== undefined) {
          semanticIssues.push(
            ...unavailableForRules(group.rules, input.policy, group.crossField),
          );
        }
        continue;
      }
      throw error;
    }
    if (input.signal?.aborted) {
      throw abortError();
    }
    return assembleResult(input.data, input.zodIssues, semanticIssues);
  } finally {
    combined.dispose();
  }
}
