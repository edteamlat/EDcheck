import type { ZodObject, ZodType } from "zod";

export function objectShape(schema: ZodType): Record<string, ZodType> | undefined {
  if (schema.type !== "object") {
    return undefined;
  }
  return (schema as ZodObject).shape as Record<string, ZodType>;
}
