import type { BoundRule } from "./bound-rule.ts";

export type BoundRuleWithValue = BoundRule & { value: unknown };
