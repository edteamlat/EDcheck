import type { ContextObject } from "./types/context-object.ts";
import type { EffectiveContext } from "./types/effective-context.ts";

export function mergeContexts(levels: readonly ContextObject[]): EffectiveContext {
  const effective: EffectiveContext = {};
  const notes: string[] = [];
  for (const level of levels) {
    for (const [key, value] of Object.entries(level)) {
      if (key === "notes") {
        continue;
      }
      effective[key] = value;
    }
    if (level.notes !== undefined) {
      notes.push(...level.notes);
    }
  }
  if (notes.length > 0) {
    effective.notes = notes;
  }
  return effective;
}
