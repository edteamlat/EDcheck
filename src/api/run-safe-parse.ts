import type { output, ZodObject } from "zod";

import type { FailurePolicy } from "../policy/types/failure-policy.ts";
import type { SemanticProvider } from "../providers/types/semantic-provider.ts";
import { fromZodIssue } from "../result/from-zod-issue.ts";
import type { SemanticResult } from "../result/types/semantic-result.ts";
import { collectInvalidPrefixes } from "../schema/collect-invalid-prefixes.ts";
import { assertServerEnvironment } from "../shared/assert-server-environment.ts";

import { collectExecutableCrossFields } from "./collect-executable-cross-fields.ts";
import { collectExecutableRules } from "./collect-executable-rules.ts";
import { runRules } from "./run-rules.ts";
import { toAbortError } from "./to-abort-error.ts";
import type { BoundCrossField } from "./types/bound-cross-field.ts";
import type { BoundRule } from "./types/bound-rule.ts";
import type { EDcheckHooks } from "./types/edcheck-hooks.ts";

export async function runSafeParse<S extends ZodObject>(input: {
  schema: S;
  data: unknown;
  boundRules: readonly BoundRule[];
  boundCrossFields?: readonly BoundCrossField[];
  provider: SemanticProvider;
  timeoutMs: number;
  policy: FailurePolicy;
  hooks: EDcheckHooks;
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
  return runRules({
    rules: collectExecutableRules(
      input.boundRules,
      input.data,
      shapeData,
      parsed.success,
      invalidPrefixes,
    ),
    crossField: collectExecutableCrossFields(
      input.boundCrossFields ?? [],
      input.data,
      shapeData,
      parsed.success,
      invalidPrefixes,
    ),
    data: shapeData,
    zodIssues,
    provider: input.provider,
    timeoutMs: input.timeoutMs,
    policy: input.policy,
    hooks: input.hooks,
    signal: input.signal,
    entry: "object",
  });
}
