import type { core } from "zod";

import type { Issue } from "./types/issue.ts";

export function fromZodIssue(issue: core.$ZodIssue): Issue {
  return {
    ...issue,
    path: issue.path.map((segment) => (typeof segment === "symbol" ? String(segment) : segment)),
    severity: "error",
  };
}
