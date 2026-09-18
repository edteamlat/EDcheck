import type { output, ZodObject } from "zod";

import { compileRequest } from "../compiler/compile-request.ts";
import { planGroups } from "../compiler/plan-groups.ts";
import { EDcheckProviderError } from "../errors/edcheck-provider-error.ts";
import type { FailurePolicy } from "../policy/types/failure-policy.ts";
import type { SemanticProvider } from "../providers/types/semantic-provider.ts";
import { assembleResult } from "../result/assemble-result.ts";
import { fromZodIssue } from "../result/from-zod-issue.ts";
import type { Issue } from "../result/types/issue.ts";
import type { SemanticResult } from "../result/types/semantic-result.ts";
import { collectInvalidPrefixes } from "../schema/collect-invalid-prefixes.ts";
import { assertServerEnvironment } from "../shared/assert-server-environment.ts";
import { combineSignals } from "../shared/combine-signals.ts";

import { assertCompleteResponse } from "./assert-complete-response.ts";
import { collectExecutableRules } from "./collect-executable-rules.ts";
import { isTimeoutReason } from "./is-timeout-reason.ts";
import { mapSemanticIssues } from "./map-semantic-issues.ts";
import { toAbortError } from "./to-abort-error.ts";
import type { BoundRule } from "./types/bound-rule.ts";
import { unavailableForRules } from "./unavailable-for-rules.ts";

export async function runSafeParse<S extends ZodObject>(input: {
  schema: S;
  data: unknown;
  boundRules: readonly BoundRule[];
  provider: SemanticProvider;
  timeoutMs: number;
  policy: FailurePolicy;
  signal?: AbortSignal | undefined;
}): Promise<SemanticResult<output<S>>> {
  assertServerEnvironment();
  if (input.signal?.aborted) {
    throw toAbortError(input.signal.reason);
  }

  const parsed = input.schema.safeParse(input.data);
  const zodIssues = parsed.success ? [] : parsed.error.issues.map(fromZodIssue);
  const shapeData = parsed.success ? parsed.data : undefined;
  const invalidPrefixes = parsed.success ? [] : collectInvalidPrefixes(parsed.error.issues);
  const executable = collectExecutableRules(
    input.boundRules,
    input.data,
    shapeData,
    parsed.success,
    invalidPrefixes,
  );

  if (executable.length === 0) {
    return assembleResult(shapeData, zodIssues, []);
  }

  const groups = planGroups(executable);
  const signals = input.signal === undefined ? [] : [input.signal];
  const combined = combineSignals(signals, { timeoutMs: input.timeoutMs });
  try {
    const settled = await Promise.allSettled(
      groups.map(async (group) => {
        const request = compileRequest(group);
        const response = await input.provider.evaluate(request, { signal: combined.signal });
        assertCompleteResponse(
          response,
          group.rules.map((rule) => rule.ruleId),
        );
        return mapSemanticIssues(group.rules, response);
      }),
    );
    if (input.signal?.aborted) {
      throw toAbortError(input.signal.reason);
    }
    const semanticIssues: Issue[] = [];
    for (const [index, result] of settled.entries()) {
      if (result.status === "fulfilled") {
        semanticIssues.push(...result.value);
        continue;
      }
      const error = result.reason;
      if (input.signal?.aborted) {
        throw toAbortError(input.signal.reason);
      }
      if (error instanceof EDcheckProviderError || isTimeoutReason(error)) {
        const group = groups[index];
        if (group !== undefined) {
          semanticIssues.push(...unavailableForRules(group.rules, input.policy));
        }
        continue;
      }
      throw error;
    }
    return assembleResult(shapeData, zodIssues, semanticIssues);
  } finally {
    combined.dispose();
  }
}
