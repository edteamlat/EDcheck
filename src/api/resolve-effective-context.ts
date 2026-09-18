import { mergeContexts } from "../context/merge-contexts.ts";
import type { ContextObject } from "../context/types/context-object.ts";
import type { EffectiveContext } from "../context/types/effective-context.ts";
import { throwConfigError } from "../shared/throw-config-error.ts";
import { stableStringify } from "../shared/stable-stringify.ts";

export function resolveEffectiveContext(
  levels: readonly ContextObject[],
): { context: EffectiveContext; groupKey: string } {
  const context = mergeContexts(levels);
  try {
    return { context, groupKey: stableStringify(context) };
  } catch {
    throwConfigError("Context must be JSON-serializable.", "invalid_context");
  }
}
