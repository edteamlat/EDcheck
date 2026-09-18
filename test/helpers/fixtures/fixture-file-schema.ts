import { z } from "zod";

const idSchema = z.string().regex(/^[a-z0-9-]+$/);

const noulExpectSchema = z.enum(["positive", "negative", "ambiguous"]);

const scoreExpectSchema = z.union([
  z.object({ level: z.string().min(1) }),
  z.literal("ambiguous"),
]);

const valueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.record(z.string(), z.unknown()),
]);

const caseSchema = z.object({
  id: idSchema,
  expect: z.union([noulExpectSchema, z.object({ level: z.string().min(1) })]),
  value: valueSchema,
  tags: z.array(z.string()).optional(),
  note: z.string().optional(),
});

export const fixtureFileSchema = z
  .object({
    rule: z.string().min(1),
    kind: z.enum(["noul", "score"]),
    language: z.enum(["es", "en"]),
    cases: z.array(caseSchema),
  })
  .superRefine((file, ctx) => {
    const seen = new Map<string, number>();
    for (const [index, item] of file.cases.entries()) {
      const previous = seen.get(item.id);
      if (previous !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["cases", index, "id"],
          message: `duplicate id "${item.id}"`,
        });
      } else {
        seen.set(item.id, index);
      }
      if (file.kind === "noul") {
        const noul = noulExpectSchema.safeParse(item.expect);
        if (!noul.success) {
          ctx.addIssue({
            code: "custom",
            path: ["cases", index, "expect"],
            message: `id "${item.id}" must use a Noul expect`,
          });
        }
        continue;
      }
      const score = scoreExpectSchema.safeParse(item.expect);
      if (!score.success) {
        ctx.addIssue({
          code: "custom",
          path: ["cases", index, "expect"],
          message: `id "${item.id}" must use a Score expect`,
        });
      }
    }
  });
