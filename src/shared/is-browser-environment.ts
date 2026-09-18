export function isBrowserEnvironment(): boolean {
  const globalRecord = globalThis as typeof globalThis & {
    window?: unknown;
    document?: unknown;
  };
  return globalRecord.window !== undefined && globalRecord.document !== undefined;
}
