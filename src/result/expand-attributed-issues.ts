import type { Issue } from "./types/issue.ts";

export function expandAttributedIssues(issues: readonly Issue[]): Issue[] {
  const expanded: Issue[] = [];
  for (const issue of issues) {
    if (issue.paths === undefined) {
      expanded.push(issue);
      continue;
    }
    for (const path of issue.paths) {
      expanded.push({
        ...issue,
        path: [...path],
        paths: issue.paths.map((item) => [...item]),
      });
    }
  }
  return expanded;
}
