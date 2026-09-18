import type { ZodObject } from "zod";

import type { EDcheck, SemanticSchema } from "edcheck";

import type { FixtureKind } from "./fixture-kind.ts";

export type FixtureBinding = {
  readonly rule: string;
  readonly kind: FixtureKind;
  readonly schema: ZodObject;
  readonly define: (edcheck: EDcheck) => SemanticSchema<ZodObject>;
  readonly toInput: (value: unknown) => Record<string, unknown>;
  readonly ruleId: string;
  readonly levels?: readonly string[];
};
