import { describe } from "vitest";

import { hasEvalKey } from "./has-eval-key.ts";

export function describeEval(name: string, fn: () => void): void {
  describe.skipIf(!hasEvalKey())(name, { timeout: 60_000 }, fn);
}
