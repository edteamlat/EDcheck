import type { output, ZodObject } from "zod";

import type { SemanticResult } from "../../result/types/semantic-result.ts";

import type { NodePath } from "./node-path.ts";
import type { ParseOptions } from "./parse-options.ts";
import type { SemanticNode } from "./semantic-node.ts";

export type SemanticSchema<S extends ZodObject> = {
  readonly schema: S;
  safeParse(data: unknown, options?: ParseOptions): Promise<SemanticResult<output<S>>>;
  node<P extends NodePath<output<S>>>(path: P): SemanticNode<S, P>;
};
