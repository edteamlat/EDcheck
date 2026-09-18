import { isPathPrefix } from "../shared/is-path-prefix.ts";
import { getAtPath } from "../shared/get-at-path.ts";

import type { BoundRule } from "./types/bound-rule.ts";
import type { BoundRuleWithValue } from "./types/bound-rule-with-value.ts";

export type ExecutableRule = BoundRuleWithValue;

export function collectExecutableRules(
  boundRules: readonly BoundRule[],
  input: unknown,
  parsedData: unknown,
  shapeSuccess: boolean,
  invalidPrefixes: ReadonlyArray<ReadonlyArray<string | number>>,
): ExecutableRule[] {
  const executable: ExecutableRule[] = [];
  for (const bound of boundRules) {
    if (invalidPrefixes.some((prefix) => isPathPrefix(prefix, bound.path))) {
      continue;
    }
    const value = readRuleValue(bound, input, parsedData, shapeSuccess);
    if (value === undefined || value === null) {
      continue;
    }
    executable.push({ ...bound, value });
  }
  return executable;
}

function readRuleValue(
  bound: BoundRule,
  input: unknown,
  parsedData: unknown,
  shapeSuccess: boolean,
): unknown {
  if (shapeSuccess) {
    return getAtPath(parsedData, bound.path);
  }
  const parsed = bound.node.safeParse(getAtPath(input, bound.path));
  if (!parsed.success) {
    return undefined;
  }
  return parsed.data;
}
