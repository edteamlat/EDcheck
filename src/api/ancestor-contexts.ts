import type { ContextObject } from "../context/types/context-object.ts";
import { formatPath } from "../shared/format-path.ts";

export function ancestorContexts(
  path: readonly string[],
  nodeContexts: ReadonlyMap<string, ContextObject>,
): ContextObject[] {
  const collected: ContextObject[] = [];
  for (let length = 1; length <= path.length; length += 1) {
    const key = formatPath(path.slice(0, length));
    const context = nodeContexts.get(key);
    if (context !== undefined) {
      collected.push(context);
    }
  }
  return collected;
}
