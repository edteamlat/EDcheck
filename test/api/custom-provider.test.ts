import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createEDcheck, semantic, type SemanticProvider, type SemanticRequest } from "edcheck";

describe("custom provider", () => {
  it("is accepted by createEDcheck", async () => {
    let received: SemanticRequest | undefined;
    const provider: SemanticProvider = {
      name: "hand-written",
      evaluate: async (request) => {
        received = request;
        return {
          model: "custom",
          answers: Object.fromEntries(
            Object.keys(request.questions).map((id) => [id, { type: "noul" as const, noul: 0.95 }]),
          ),
        };
      },
    };
    const result = await createEDcheck({ provider })
      .define(z.object({ fullName: z.string() }), {
        rules: { fullName: semantic("A plausible full name for a real person") },
      })
      .safeParse({ fullName: "Ana Pérez" });
    expect(result.issues).toEqual([]);
    expect(received?.questions).toHaveProperty("fullName");
  });
});
