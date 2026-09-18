import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createEDcheck, typesafeProvider } from "edcheck";

import en from "../fixtures/project-description/en.json";
import es from "../fixtures/project-description/es.json";
import { projectDescriptionRule } from "../helpers/project-description-rule.ts";

const fixtures = { en, es };
const apiKey = process.env.TYPESAFE_API_KEY;

function observedLevel(issues: Array<{ ruleId?: string; level?: string }>): string {
  return issues.find((issue) => issue.ruleId === "description")?.level ?? "clear";
}

describe.skipIf(!apiKey)("project-description eval", () => {
  const bound = () =>
    createEDcheck({
      provider: typesafeProvider({ apiKey: apiKey as string }),
    }).define(z.object({ description: z.string() }), {
      rules: { description: projectDescriptionRule() },
    });

  for (const [locale, fixture] of Object.entries(fixtures)) {
    it(`matches expected levels for ${locale} with at most one miss`, async () => {
      const misses: Array<{ text: string; expected: string; observed: string }> = [];
      for (const item of fixture.cases) {
        const result = await bound().safeParse({ description: item.text });
        const observed = observedLevel(result.issues);
        if (observed !== item.expectedLevel) {
          misses.push({ text: item.text, expected: item.expectedLevel, observed });
        }
      }
      expect(misses, JSON.stringify(misses)).toHaveLength(Math.min(misses.length, 1));
      expect(misses.length).toBeLessThanOrEqual(1);
    });

    it(`records ${locale} ambiguous cases without asserting them`, async () => {
      const observed = [];
      for (const item of fixture.ambiguous) {
        const result = await bound().safeParse({ description: item.text });
        observed.push({
          text: item.text,
          level: observedLevel(result.issues),
        });
      }
      expect(observed, `ambiguous ${locale}: ${JSON.stringify(observed)}`).toHaveLength(
        fixture.ambiguous.length,
      );
    });
  }
});
