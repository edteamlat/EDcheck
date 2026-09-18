export function setAtPath(
  target: Record<string, unknown>,
  path: readonly string[],
  value: unknown,
): void {
  if (path.length === 0) {
    return;
  }
  let current = target;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    if (key === undefined) {
      return;
    }
    const next = current[key];
    if (next === undefined || typeof next !== "object" || next === null || Array.isArray(next)) {
      const created: Record<string, unknown> = {};
      current[key] = created;
      current = created;
    } else {
      current = next as Record<string, unknown>;
    }
  }
  const last = path[path.length - 1];
  if (last !== undefined) {
    current[last] = value;
  }
}
