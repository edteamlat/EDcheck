import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createEDcheck, semantic, typesafeProvider } from "edcheck";

import en from "../fixtures/age-occupation/en.json";
import es from "../fixtures/age-occupation/es.json";

const fixtures = { en, es };
const apiKey = process.env.TYPESAFE_API_KEY;

const rule = semantic({
  intent: "The `occupation` is plausible for someone of the given `age`",
  invalid: "The `occupation` requires more years than the `age` allows",
  id: "occupation_age_coherence",
});

describe.skipIf(!apiKey)("age-occupation eval", () => {
  const bound = () =>
    createEDcheck({
      provider: typesafeProvider({ apiKey: apiKey as string }),
    }).define(z.object({ age: z.number(), occupation: z.string() }), {
      rules: {},
      crossField: [{ paths: ["age", "occupation"], rule }],
    });

  for (const [locale, cases] of Object.entries(fixtures)) {
    it(`scores ${locale} positives at or above 0.6`, async () => {
      for (const value of cases.positive) {
        const result = await bound().safeParse(value);
        const issue = result.issues.find((item) => item.ruleId === "occupation_age_coherence");
        const probability = issue?.probability ?? 1;
        expect(probability, `positive ${JSON.stringify(value)}`).toBeGreaterThanOrEqual(0.6);
      }
    });

    it(`scores ${locale} negatives at or below 0.4`, async () => {
      for (const value of cases.negative) {
        const result = await bound().safeParse(value);
        const issue = result.issues.find((item) => item.ruleId === "occupation_age_coherence");
        const probability = issue?.probability ?? 1;
        expect(probability, `negative ${JSON.stringify(value)}`).toBeLessThanOrEqual(0.4);
      }
    });

    it(`records ${locale} ambiguous cases without asserting them`, async () => {
      const observed = [];
      for (const value of cases.ambiguous) {
        const result = await bound().safeParse(value);
        observed.push({
          value,
          probability: result.issues.find((item) => item.ruleId === "occupation_age_coherence")
            ?.probability,
        });
      }
      expect(observed, `ambiguous ${locale}: ${JSON.stringify(observed)}`).toHaveLength(
        cases.ambiguous.length,
      );
    });
  }
});
