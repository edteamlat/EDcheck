import type { FixtureCase } from "./fixture-case.ts";
import type { FixtureKind } from "./fixture-kind.ts";
import type { FixtureLanguage } from "./fixture-language.ts";

export type FixtureFile = {
  readonly rule: string;
  readonly kind: FixtureKind;
  readonly language: FixtureLanguage;
  readonly cases: readonly FixtureCase[];
};
