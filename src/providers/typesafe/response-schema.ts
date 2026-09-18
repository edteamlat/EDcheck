import { z } from "zod";

export const typesafeResponseSchema = z.object({
  model: z.string(),
  answers: z.record(
    z.string(),
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("noul"),
        noul: z.number().min(0).max(1),
      }),
      z.object({
        type: z.literal("score"),
        score: z.number().finite(),
        probabilities: z.record(z.string(), z.number()),
        confidence: z.number().min(0).max(1),
        legend: z.record(z.string(), z.string()).optional(),
      }),
    ]),
  ),
  usage: z
    .object({
      input_tokens: z.number(),
      output_tokens: z.number(),
    })
    .optional(),
});
