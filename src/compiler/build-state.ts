import { setAtPath } from "../shared/set-at-path.ts";

import type { StateField } from "./types/state-field.ts";

export function buildState(fields: readonly StateField[]): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  for (const field of fields) {
    setAtPath(state, [...field.path], field.value);
  }
  return state;
}
