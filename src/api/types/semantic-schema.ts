import type { output, ZodObject } from "zod";

import type { SemanticResult } from "../../result/types/semantic-result.ts";

import type { ParseOptions } from "./parse-options.ts";

export type SemanticSchema<S extends ZodObject> = {
  readonly schema: S;
  safeParse(data: unknown, options?: ParseOptions): Promise<SemanticResult<output<S>>>;
};
