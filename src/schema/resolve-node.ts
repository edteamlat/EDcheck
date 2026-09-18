import type { ZodType } from "zod";

import { EDcheckConfigError } from "../errors/edcheck-config-error.ts";
import { formatPath } from "../shared/format-path.ts";

import { classifyNode } from "./classify-node.ts";
import { isPrimitiveKind } from "./is-primitive-kind.ts";
import { objectShape } from "./object-shape.ts";
import type { ResolvedNode } from "./types/resolved-node.ts";
import { unwrapNode } from "./unwrap-node.ts";

function unsupported(dottedPath: string, kind: string): never {
  const arrayNote =
    kind === "array"
      ? " Rules on or through arrays are not supported in v1."
      : "";
  throw new EDcheckConfigError(
    `Path "${dottedPath}" resolves to an unsupported ${kind} node.${arrayNote}`,
    "unsupported_node",
    { path: dottedPath },
  );
}

export function resolveNode(schema: ZodType, dottedPath: string): ResolvedNode {
  const path = dottedPath.split(".");
  let current = unwrapNode(schema);
  for (let index = 0; index < path.length; index += 1) {
    const segment = path[index];
    if (segment === undefined) {
      break;
    }
    const kind = classifyNode(current);
    if (kind === "array") {
      unsupported(dottedPath, "array");
    }
    const shape = objectShape(current);
    if (shape === undefined) {
      throw new EDcheckConfigError(`Unknown path "${dottedPath}".`, "unknown_path", {
        path: dottedPath,
      });
    }
    const child = shape[segment];
    if (child === undefined) {
      throw new EDcheckConfigError(`Unknown path "${dottedPath}".`, "unknown_path", {
        path: dottedPath,
      });
    }
    if (index === path.length - 1) {
      const kind = classifyNode(unwrapNode(child));
      if (kind === "array") {
        unsupported(dottedPath, "array");
      }
      if (!isPrimitiveKind(kind)) {
        unsupported(dottedPath, kind);
      }
      return {
        path,
        dottedPath: formatPath(path),
        node: child,
        kind,
      };
    }
    current = unwrapNode(child);
  }
  throw new EDcheckConfigError(`Unknown path "${dottedPath}".`, "unknown_path", {
    path: dottedPath,
  });
}
