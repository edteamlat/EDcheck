import type { output, ZodObject } from "zod";

import type { Context } from "../../context/types/context.ts";
import type { FailurePolicy } from "../../policy/types/failure-policy.ts";
import type { Thresholds } from "../../policy/types/thresholds.ts";
import type { SemanticRule } from "../../rules/types/semantic-rule.ts";

import type { FieldPath } from "./field-path.ts";
import type { NodePath } from "./node-path.ts";

export type SemanticSchemaOptions<S extends ZodObject> = {
  rules: Partial<Record<FieldPath<output<S>>, SemanticRule>>;
  thresholds?: Partial<Thresholds>;
  policy?: FailurePolicy;
  context?: Context;
  nodeContext?: Partial<Record<NodePath<output<S>>, Context>>;
};
