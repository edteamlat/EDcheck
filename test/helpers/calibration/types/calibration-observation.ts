import type { FixtureExpect } from "../../fixtures/types/fixture-expect.ts";

export type CalibrationObservation = {
  readonly id: string;
  readonly expect: FixtureExpect;
  readonly probability?: number;
};
