import type { SemanticProvider } from "edcheck";

import type { FixtureBinding } from "../../fixtures/types/fixture-binding.ts";
import type { FixtureFile } from "../../fixtures/types/fixture-file.ts";

export type RunCasesInput = {
  readonly binding: FixtureBinding;
  readonly file: FixtureFile;
  readonly provider: SemanticProvider;
  readonly concurrency?: number;
  readonly timeoutMs?: number;
};
