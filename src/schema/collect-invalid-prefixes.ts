export function collectInvalidPrefixes(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }>,
): Array<Array<string | number>> {
  return issues.map((issue) =>
    issue.path.map((segment) => (typeof segment === "symbol" ? String(segment) : segment)),
  );
}
