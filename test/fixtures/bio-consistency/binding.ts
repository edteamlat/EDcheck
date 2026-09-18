import { z } from "zod";

import { semantic, type EDcheck } from "edcheck";

import type { FixtureBinding } from "../../helpers/fixtures/types/fixture-binding.ts";

const schema = z.object({
  name: z.string().min(1),
  occupation: z.string().min(1),
  bio: z.string().min(1),
});

export const bioConsistencyBinding: FixtureBinding = {
  rule: "bio-consistency",
  kind: "noul",
  schema,
  define: (edcheck: EDcheck) =>
    edcheck.define(schema, {
      rules: {},
      crossField: [
        {
          paths: ["name", "occupation", "bio"],
          rule: semantic({
            intent: "The biography is consistent with the supplied name and occupation",
          }),
        },
      ],
    }),
  toInput: (value: unknown) => {
    if (typeof value !== "object" || value === null) {
      throw new Error("bio-consistency value must be an object");
    }
    return value as Record<string, unknown>;
  },
  ruleId: "name+occupation+bio",
};
