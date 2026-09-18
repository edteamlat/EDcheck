import { isPathPrefix } from "../shared/is-path-prefix.ts";

export function selectRulesUnderPath<
  R extends { path: readonly string[] },
  C extends { paths: ReadonlyArray<ReadonlyArray<string>> } = { paths: ReadonlyArray<ReadonlyArray<string>> },
>(
  nodePath: readonly string[],
  boundRules: readonly R[],
  boundCrossFields: readonly C[] = [],
): { rules: R[]; crossField: C[] } {
  return {
    rules: boundRules.filter((rule) => isPathPrefix(nodePath, rule.path)),
    crossField: boundCrossFields.filter((binding) =>
      binding.paths.every((path) => isPathPrefix(nodePath, path)),
    ),
  };
}
