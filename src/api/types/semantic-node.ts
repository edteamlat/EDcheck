import type { output, ZodObject, ZodType } from "zod";

import type { SemanticResult } from "../../result/types/semantic-result.ts";

import type { NodePath } from "./node-path.ts";
import type { ParseOptions } from "./parse-options.ts";
import type { PathValue } from "./path-value.ts";

export type SemanticNode<S extends ZodObject, P extends NodePath<output<S>>> = {
  readonly path: readonly string[];
  readonly schema: ZodType;
  readonly ruleIds: readonly string[];
  safeParse(
    value: unknown,
    options?: ParseOptions,
  ): Promise<SemanticResult<PathValue<output<S>, P>>>;
};
