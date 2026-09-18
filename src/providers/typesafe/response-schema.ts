import { z } from "zod";

export const typesafeResponseSchema = z.object({
  model: z.string(),
  answers: z.record(
    z.string(),
    z.object({
      type: z.literal("noul"),
      noul: z.number().min(0).max(1),
    }),
  ),
  usage: z
    .object({
      input_tokens: z.number(),
      output_tokens: z.number(),
    })
    .optional(),
});
