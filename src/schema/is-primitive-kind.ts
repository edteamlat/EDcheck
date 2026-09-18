import type { NodeKind } from "./types/node-kind.ts";

const PRIMITIVES = new Set<NodeKind>(["string", "number", "boolean", "enum", "literal"]);

export function isPrimitiveKind(kind: NodeKind): boolean {
  return PRIMITIVES.has(kind);
}
