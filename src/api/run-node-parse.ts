import type { ZodType } from "zod";

import type { FailurePolicy } from "../policy/types/failure-policy.ts";
import type { SemanticProvider } from "../providers/types/semantic-provider.ts";
import { fromZodIssue } from "../result/from-zod-issue.ts";
import { prefixIssuePaths } from "../result/prefix-issue-paths.ts";
import type { SemanticResult } from "../result/types/semantic-result.ts";
import { collectInvalidPrefixes } from "../schema/collect-invalid-prefixes.ts";
import { assertServerEnvironment } from "../shared/assert-server-environment.ts";
import { getAtPath } from "../shared/get-at-path.ts";
import { isPathPrefix } from "../shared/is-path-prefix.ts";

import type { ExecutableCrossField } from "./collect-executable-cross-fields.ts";
import { runRules } from "./run-rules.ts";
import { toAbortError } from "./to-abort-error.ts";
import type { BoundCrossField } from "./types/bound-cross-field.ts";
import type { BoundRule } from "./types/bound-rule.ts";
import type { BoundRuleWithValue } from "./types/bound-rule-with-value.ts";
import type { EDcheckHooks } from "./types/edcheck-hooks.ts";
import type { ParseOptions } from "./types/parse-options.ts";

export async function runNodeParse<T>(input: {
  node: ZodType;
  nodePath: readonly string[];
  value: unknown;
  boundRules: readonly BoundRule[];
  boundCrossFields: readonly BoundCrossField[];
  provider: SemanticProvider;
  timeoutMs: number;
  policy: FailurePolicy;
  hooks: EDcheckHooks;
  options?: ParseOptions;
}): Promise<SemanticResult<T>> {
  assertServerEnvironment();
  if (input.options?.signal?.aborted) {
    throw toAbortError(input.options.signal.reason);
  }

  const parsed = input.node.safeParse(input.value);
  const zodIssues = prefixIssuePaths(
    parsed.success ? [] : parsed.error.issues.map(fromZodIssue),
    input.nodePath,
  );
  const output = parsed.success ? parsed.data : undefined;
  const invalidPrefixes = parsed.success ? [] : collectInvalidPrefixes(zodIssues);
  const root = parsed.success ? output : input.value;

  return runRules({
    rules: collectNodeRules(input.boundRules, input.nodePath, root, parsed.success, invalidPrefixes),
    crossField: collectNodeCrossFields(
      input.boundCrossFields,
      input.nodePath,
      root,
      parsed.success,
      invalidPrefixes,
    ),
    data: output as T | undefined,
    zodIssues,
    provider: input.provider,
    timeoutMs: input.options?.timeoutMs ?? input.timeoutMs,
    policy: input.policy,
    hooks: input.hooks,
    signal: input.options?.signal,
    entry: "node",
    path: input.nodePath,
  });
}

function collectNodeRules(
  rules: readonly BoundRule[],
  nodePath: readonly string[],
  root: unknown,
  shapeSuccess: boolean,
  invalidPrefixes: ReadonlyArray<ReadonlyArray<string | number>>,
): BoundRuleWithValue[] {
  const executable: BoundRuleWithValue[] = [];
  for (const rule of rules) {
    if (invalidPrefixes.some((prefix) => isPathPrefix(prefix, rule.path))) {
      continue;
    }
    const value = readRelativeValue(root, rule.path, nodePath, rule.node, shapeSuccess);
    if (value === undefined || value === null) {
      continue;
    }
    executable.push({ ...rule, value });
  }
  return executable;
}

function collectNodeCrossFields(
  bindings: readonly BoundCrossField[],
  nodePath: readonly string[],
  root: unknown,
  shapeSuccess: boolean,
  invalidPrefixes: ReadonlyArray<ReadonlyArray<string | number>>,
): ExecutableCrossField[] {
  const executable: ExecutableCrossField[] = [];
  for (const binding of bindings) {
    if (
      invalidPrefixes.some((prefix) =>
        binding.paths.some((path) => isPathPrefix(prefix, path)),
      )
    ) {
      continue;
    }
    const values: unknown[] = [];
    let skipped = false;
    for (const [index, path] of binding.paths.entries()) {
      const node = binding.nodes[index];
      if (node === undefined) {
        skipped = true;
        break;
      }
      const value = readRelativeValue(root, path, nodePath, node, shapeSuccess);
      if (value === undefined || value === null) {
        skipped = true;
        break;
      }
      values.push(value);
    }
    if (!skipped) {
      executable.push({ ...binding, values });
    }
  }
  return executable;
}

function readRelativeValue(
  root: unknown,
  absolutePath: readonly string[],
  nodePath: readonly string[],
  node: ZodType,
  shapeSuccess: boolean,
): unknown {
  const relative = absolutePath.slice(nodePath.length);
  const raw = getAtPath(root, relative);
  if (shapeSuccess) {
    return raw;
  }
  const parsed = node.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}
