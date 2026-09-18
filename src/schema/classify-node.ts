import type { ZodType } from "zod";

import type { NodeKind } from "./types/node-kind.ts";

const KINDS = new Set<NodeKind>([
  "string",
  "number",
  "boolean",
  "enum",
  "literal",
  "array",
  "object",
  "union",
  "pipe",
  "date",
]);

export function classifyNode(schema: ZodType): NodeKind {
  const type = schema.type;
  if (KINDS.has(type as NodeKind)) {
    return type as NodeKind;
  }
  return "other";
}
