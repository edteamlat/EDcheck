import type { output, ZodObject } from "zod";

import type { Context } from "../../context/types/context.ts";
import type { FailurePolicy } from "../../policy/types/failure-policy.ts";
import type { Thresholds } from "../../policy/types/thresholds.ts";
import type { SemanticRule } from "../../rules/types/semantic-rule.ts";

import type { CrossFieldBinding } from "./cross-field-binding.ts";
import type { FieldPath } from "./field-path.ts";
import type { NodePath } from "./node-path.ts";

export type SemanticSchemaOptions<S extends ZodObject> = {
  rules: Partial<Record<FieldPath<output<S>>, SemanticRule>>;
  crossField?: readonly CrossFieldBinding<output<S>>[];
  thresholds?: Partial<Thresholds>;
  minConfidence?: number;
  policy?: FailurePolicy;
  context?: Context;
  nodeContext?: Partial<Record<NodePath<output<S>>, Context>>;
};
