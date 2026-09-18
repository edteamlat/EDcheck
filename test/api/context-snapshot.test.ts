import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createEDcheck, mockProvider, semantic } from "edcheck";

const pdrProjectContext = {
  domain: "software services",
  purpose: "create_project",
  audience: "client",
  locale: "es-BO",
};

const firstPositiveName = "Ana Pérez";

const nameRule = semantic("A plausible full name for a real person");
const bioRule = semantic({
  intent: "Meaningful professional biography",
  valid: "Describes the person's professional background coherently",
  invalid: "Meaningless, irrelevant or clearly unrelated text",
});

describe("context in state", () => {
  it("Context key shape", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider, context: { domain: "software" } })
      .define(z.object({ fullName: z.string() }), {
        rules: {
          fullName: semantic({ intent: nameRule.intent, context: "Spanish speakers" }),
        },
      })
      .safeParse({ fullName: "Ana Pérez" });
    expect(provider.calls[0]?.state).toEqual({
      fullName: "Ana Pérez",
      context: { domain: "software", notes: ["Spanish speakers"] },
    });
  });

  it("Empty effective context leaves the bootstrap payload unchanged", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider, context: {} })
      .define(z.object({ fullName: z.string(), bio: z.string() }), {
        rules: { fullName: nameRule, bio: bioRule },
        context: {},
        nodeContext: {},
      })
      .safeParse({ fullName: firstPositiveName, bio: "Ingeniera de software" });
    expect(provider.calls[0]).toMatchSnapshot();
  });

  it("Snapshot with the PDR project context", async () => {
    const provider = mockProvider();
    await createEDcheck({ provider })
      .define(z.object({ fullName: z.string() }), {
        rules: { fullName: nameRule },
        context: pdrProjectContext,
      })
      .safeParse({ fullName: firstPositiveName });
    expect(provider.calls[0]).toMatchSnapshot();
  });
});
