import type { ContextObject } from "./types/context-object.ts";

export function isEmptyContext(context: ContextObject): boolean {
  return Object.keys(context).length === 0;
}
