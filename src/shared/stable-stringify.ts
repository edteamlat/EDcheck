export function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  const walk = (current: unknown): unknown => {
    if (current === null || typeof current !== "object") {
      return current;
    }
    if (seen.has(current)) {
      throw new TypeError("Cannot serialize a cyclic context value.");
    }
    seen.add(current);
    if (Array.isArray(current)) {
      return current.map(walk);
    }
    const record = current as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = walk(record[key]);
    }
    return sorted;
  };

  return JSON.stringify(walk(value));
}
