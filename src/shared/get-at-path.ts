export function getAtPath(target: unknown, path: ReadonlyArray<string | number>): unknown {
  let current: unknown = target;
  for (const segment of path) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string | number, unknown>)[segment];
  }
  return current;
}
