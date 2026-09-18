import type { SemanticRule } from "../../rules/types/semantic-rule.ts";

import type { NodePath } from "./node-path.ts";

export type CrossFieldBinding<T> = {
  readonly paths: readonly [NodePath<T>, ...NodePath<T>[]];
  readonly rule: SemanticRule;
};
