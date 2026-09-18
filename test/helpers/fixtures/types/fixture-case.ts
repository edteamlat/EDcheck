import type { FixtureExpect } from "./fixture-expect.ts";
import type { FixtureValue } from "./fixture-value.ts";

export type FixtureCase = {
  readonly id: string;
  readonly expect: FixtureExpect;
  readonly value: FixtureValue;
  readonly tags?: readonly string[];
  readonly note?: string;
};
