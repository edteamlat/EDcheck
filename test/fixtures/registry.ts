import { ageOccupationBinding } from "./age-occupation/binding.ts";
import { bioConsistencyBinding } from "./bio-consistency/binding.ts";
import { fullNameBinding } from "./full-name/binding.ts";
import { projectDescriptionBinding } from "./project-description/binding.ts";
import { projectNameBinding } from "./project-name/binding.ts";
import type { FixtureBinding } from "../helpers/fixtures/types/fixture-binding.ts";

export const registry: readonly FixtureBinding[] = [
  fullNameBinding,
  projectNameBinding,
  ageOccupationBinding,
  bioConsistencyBinding,
  projectDescriptionBinding,
];
