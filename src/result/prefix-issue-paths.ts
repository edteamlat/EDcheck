import type { Issue } from "./types/issue.ts";

export function prefixIssuePaths(
  issues: readonly Issue[],
  prefix: readonly string[],
): Issue[] {
  return issues.map((issue) => ({
    ...issue,
    path: [...prefix, ...issue.path],
  }));
}
