import { z } from "zod";

import { semantic, type EDcheck } from "edcheck";

import type { FixtureBinding } from "../../helpers/fixtures/types/fixture-binding.ts";

const schema = z.object({ projectName: z.string().min(1) });

export const projectNameBinding: FixtureBinding = {
  rule: "project-name",
  kind: "noul",
  schema,
  define: (edcheck: EDcheck) =>
    edcheck.define(schema, {
      rules: { projectName: semantic("A plausible project name") },
      context: {
        domain: "enterprise software",
        purpose: "Name of an internal software project",
      },
    }),
  toInput: (value: unknown) => ({ projectName: value }),
  ruleId: "projectName",
};
