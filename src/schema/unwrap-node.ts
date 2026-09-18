import type { ZodType } from "zod";

const WRAPPERS = new Set([
  "optional",
  "nullable",
  "default",
  "prefault",
  "readonly",
  "catch",
  "nonoptional",
]);

export function unwrapNode(schema: ZodType): ZodType {
  let current = schema;
  while (WRAPPERS.has(current.type)) {
    const inner = (current.def as { innerType?: ZodType }).innerType;
    if (inner === undefined) {
      break;
    }
    current = inner;
  }
  return current;
}
