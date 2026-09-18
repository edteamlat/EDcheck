import type { FixtureExpect } from "../../fixtures/types/fixture-expect.ts";
import type { FixtureLanguage } from "../../fixtures/types/fixture-language.ts";

export type Observation = {
  readonly rule: string;
  readonly language: FixtureLanguage;
  readonly id: string;
  readonly expect: FixtureExpect;
  readonly probability?: number;
  readonly level?: string;
  readonly score?: number;
  readonly confidence?: number;
  readonly model: string;
  readonly durationMs: number;
  readonly error?: string;
};
