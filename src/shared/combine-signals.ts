import type { CombinedSignal } from "./types/combined-signal.ts";

export function combineSignals(
  signals: readonly AbortSignal[],
  options?: { timeoutMs?: number },
): CombinedSignal {
  const controller = new AbortController();
  const cleanups: Array<() => void> = [];

  const dispose = (): void => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  };

  const abort = (reason: unknown): void => {
    dispose();
    if (!controller.signal.aborted) {
      controller.abort(reason);
    }
  };

  const onAbort = (event: Event): void => {
    const target = event.target;
    if (target instanceof AbortSignal) {
      abort(target.reason);
    }
  };

  for (const signal of signals) {
    if (signal.aborted) {
      abort(signal.reason);
      return { signal: controller.signal, dispose };
    }
    signal.addEventListener("abort", onAbort);
    cleanups.push(() => signal.removeEventListener("abort", onAbort));
  }

  if (options?.timeoutMs !== undefined) {
    const timeoutId = setTimeout(() => {
      abort(new DOMException("The operation timed out", "TimeoutError"));
    }, options.timeoutMs);
    cleanups.push(() => clearTimeout(timeoutId));
  }

  return { signal: controller.signal, dispose };
}
