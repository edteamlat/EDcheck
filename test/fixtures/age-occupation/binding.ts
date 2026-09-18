import { z } from "zod";

import { semantic, type EDcheck } from "edcheck";

import type { FixtureBinding } from "../../helpers/fixtures/types/fixture-binding.ts";

const schema = z.object({
  age: z.number().int().min(0),
  occupation: z.string().min(1),
});

export const ageOccupationBinding: FixtureBinding = {
  rule: "age-occupation",
  kind: "noul",
  schema,
  define: (edcheck: EDcheck) =>
    edcheck.define(schema, {
      rules: {},
      crossField: [
        {
          paths: ["age", "occupation"],
          rule: semantic({
            intent: "The `occupation` is plausible for someone of the given `age`",
            invalid: "The `occupation` requires more years than the `age` allows",
          }),
        },
      ],
    }),
  toInput: (value: unknown) => {
    if (typeof value !== "object" || value === null) {
      throw new Error("age-occupation value must be an object");
    }
    return value as Record<string, unknown>;
  },
  ruleId: "age+occupation",
};
