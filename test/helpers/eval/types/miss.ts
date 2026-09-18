import type { FixtureExpect } from "../../fixtures/types/fixture-expect.ts";

export type Miss = {
  readonly rule: string;
  readonly language: string;
  readonly id: string;
  readonly expect: FixtureExpect;
  readonly band?: string;
  readonly probability?: number;
  readonly value?: unknown;
  readonly level?: string;
  readonly score?: number;
  readonly confidence?: number;
  readonly error?: string;
};
