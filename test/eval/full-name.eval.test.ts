import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createEDcheck, semantic, typesafeProvider } from "edcheck";

import en from "../fixtures/full-name/en.json";
import es from "../fixtures/full-name/es.json";

const fixtures = { en, es };
const apiKey = process.env.TYPESAFE_API_KEY;

describe.skipIf(!apiKey)("full-name eval", () => {
  const bound = () =>
    createEDcheck({
      provider: typesafeProvider({ apiKey: apiKey as string }),
    }).define(z.object({ fullName: z.string() }), {
      rules: { fullName: semantic("A plausible full name for a real person") },
    });

  for (const [locale, cases] of Object.entries(fixtures)) {
    it(`scores ${locale} positives at or above 0.6`, async () => {
      for (const value of cases.positive) {
        const result = await bound().safeParse({ fullName: value });
        const issue = result.issues.find((item) => item.ruleId === "fullName");
        const probability = issue?.probability ?? 1;
        expect(probability, `positive "${value}"`).toBeGreaterThanOrEqual(0.6);
      }
    });

    it(`scores ${locale} negatives at or below 0.4`, async () => {
      for (const value of cases.negative) {
        const result = await bound().safeParse({ fullName: value });
        const issue = result.issues.find((item) => item.ruleId === "fullName");
        const probability = issue?.probability ?? 1;
        expect(probability, `negative "${value}"`).toBeLessThanOrEqual(0.4);
      }
    });

    it(`records ${locale} ambiguous cases without asserting them`, async () => {
      const observed = [];
      for (const value of cases.ambiguous) {
        const result = await bound().safeParse({ fullName: value });
        observed.push({
          value,
          probability: result.issues.find((item) => item.ruleId === "fullName")?.probability,
        });
      }
      expect(observed, `ambiguous ${locale}: ${JSON.stringify(observed)}`).toHaveLength(
        cases.ambiguous.length,
      );
    });
  }
});
