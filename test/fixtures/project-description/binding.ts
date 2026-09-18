import { z } from "zod";

import type { EDcheck } from "edcheck";

import { projectDescriptionRule } from "../../helpers/project-description-rule.ts";
import type { FixtureBinding } from "../../helpers/fixtures/types/fixture-binding.ts";

const schema = z.object({ description: z.string().min(1) });

export const projectDescriptionBinding: FixtureBinding = {
  rule: "project-description",
  kind: "score",
  schema,
  define: (edcheck: EDcheck) =>
    edcheck.define(schema, {
      rules: { description: projectDescriptionRule() },
    }),
  toInput: (value: unknown) => ({ description: value }),
  ruleId: "description",
  levels: ["meaningless", "vague", "clear"],
};
