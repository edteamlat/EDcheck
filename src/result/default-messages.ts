export function defaultMessage(
  kind: "fail" | "warning" | "unavailable",
  ruleId: string,
): string {
  switch (kind) {
    case "fail":
      return `Semantic rule "${ruleId}" failed`;
    case "warning":
      return `Semantic rule "${ruleId}" is uncertain`;
    case "unavailable":
      return `Semantic validation unavailable for rule "${ruleId}"`;
  }
}
