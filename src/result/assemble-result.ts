import type { Issue } from "./types/issue.ts";
import type { SemanticResult } from "./types/semantic-result.ts";

export function assembleResult<T>(
  data: T | undefined,
  zodIssues: readonly Issue[],
  semanticIssues: readonly Issue[],
): SemanticResult<T> {
  const issues = [...zodIssues, ...semanticIssues];
  const success = !issues.some((issue) => issue.severity === "error");
  if (data === undefined) {
    return { success, issues };
  }
  return { success, data, issues };
}
