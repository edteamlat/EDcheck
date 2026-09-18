import { z } from "zod";

import { semantic, type EDcheck } from "edcheck";

import type { FixtureBinding } from "../../helpers/fixtures/types/fixture-binding.ts";

const schema = z.object({ fullName: z.string().min(1) });

export const fullNameBinding: FixtureBinding = {
  rule: "full-name",
  kind: "noul",
  schema,
  define: (edcheck: EDcheck) =>
    edcheck.define(schema, {
      rules: { fullName: semantic("A plausible full name for a real person") },
    }),
  toInput: (value: unknown) => ({ fullName: value }),
  ruleId: "fullName",
};
