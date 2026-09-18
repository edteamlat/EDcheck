import type { ZodType } from "zod";

import type { NodeKind } from "./node-kind.ts";

export type ResolvedNode = {
  path: string[];
  dottedPath: string;
  node: ZodType;
  kind: NodeKind;
};
