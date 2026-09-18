export function invokeHook<E>(
  hook: ((event: E) => void | Promise<void>) | undefined,
  event: E,
): void {
  if (hook === undefined) {
    return;
  }
  try {
    const output = hook(event);
    if (output !== undefined && output !== null && typeof output.then === "function") {
      void output.then(undefined, () => undefined);
    }
  } catch {
    /* swallowed by contract */
  }
}
