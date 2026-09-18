import type { ZodType } from "zod";

import { normalizeContext } from "../context/normalize-context.ts";
import type { Context } from "../context/types/context.ts";
import type { ContextObject } from "../context/types/context-object.ts";
import { EDcheckConfigError } from "../errors/edcheck-config-error.ts";
import { isReservedPath } from "../schema/is-reserved-path.ts";
import { resolveNode } from "../schema/resolve-node.ts";
import { parsePath } from "../shared/parse-path.ts";

export function collectNodeContexts(
  schema: ZodType,
  nodeContext: Partial<Record<string, Context>> | undefined,
): Map<string, ContextObject> {
  const resolved = new Map<string, ContextObject>();
  if (nodeContext === undefined) {
    return resolved;
  }
  for (const [dottedPath, context] of Object.entries(nodeContext)) {
    if (context === undefined) {
      continue;
    }
    if (isReservedPath(parsePath(dottedPath))) {
      throw new EDcheckConfigError(
        `Path "${dottedPath}" collides with the reserved state key "context".`,
        "reserved_path",
        { path: dottedPath },
      );
    }
    resolveNode(schema, dottedPath, { allowObject: true });
    resolved.set(dottedPath, normalizeContext(context));
  }
  return resolved;
}
