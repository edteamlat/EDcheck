import type { ZodObject } from "zod";

import type { SemanticSchema } from "./semantic-schema.ts";
import type { SemanticSchemaOptions } from "./semantic-schema-options.ts";

export type EDcheck = {
  define<S extends ZodObject>(schema: S, options: SemanticSchemaOptions<S>): SemanticSchema<S>;
};
