import type { Issue } from "./issue.ts";

export type SemanticResult<T> = {
  success: boolean;
  data?: T;
  issues: Issue[];
};
