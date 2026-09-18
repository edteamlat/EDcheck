import { isEmptyContext } from "../context/is-empty-context.ts";
import type { EffectiveContext } from "../context/types/effective-context.ts";
import { setAtPath } from "../shared/set-at-path.ts";

import type { StateField } from "./types/state-field.ts";

export function buildState(
  fields: readonly StateField[],
  context?: EffectiveContext,
): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  for (const field of fields) {
    setAtPath(state, [...field.path], field.value);
  }
  if (context !== undefined && !isEmptyContext(context)) {
    state.context = context;
  }
  return state;
}
