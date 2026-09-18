import { describe, expect, it } from "vitest";

import {
  DEFAULT_THRESHOLDS,
  EDcheckProviderError,
  mockProvider,
  type SemanticProvider,
  type SemanticRequest,
  type SemanticResponse,
} from "edcheck";

import { fullNameBinding } from "../../fixtures/full-name/binding.ts";
import { projectDescriptionBinding } from "../../fixtures/project-description/binding.ts";
import type { FixtureFile } from "../fixtures/types/fixture-file.ts";
import { countMisses } from "./count-misses.ts";
import { runCases } from "./run-cases.ts";

const noulFile: FixtureFile = {
  rule: "full-name",
  kind: "noul",
  language: "en",
  cases: [
    { id: "pos-jane", expect: "positive", value: "Jane Doe" },
    { id: "neg-keyboard", expect: "negative", value: "asdfasdf" },
    { id: "amb-alex", expect: "ambiguous", value: "Alex" },
  ],
};

function noulFixture(cases: FixtureFile["cases"]): FixtureFile {
  return { rule: "full-name", kind: "noul", language: "en", cases };
}

describe("Eval bands and miss report", () => {
  it("Bounded concurrency", async () => {
    let inflight = 0;
    let max = 0;
    const provider: SemanticProvider = {
      name: "slow",
      async evaluate(
        _request: SemanticRequest,
        options: { signal: AbortSignal },
      ): Promise<SemanticResponse> {
        inflight += 1;
        max = Math.max(max, inflight);
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 10);
          options.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            resolve();
          });
        });
        inflight -= 1;
        return { model: "slow", answers: { fullName: { type: "noul", noul: 0.9 } } };
      },
    };
    const cases = Array.from({ length: 12 }, (_, index) => ({
      id: `case-${index + 1}`,
      expect: "positive" as const,
      value: `Name ${index + 1}`,
    }));
    const observations = await runCases({
      binding: fullNameBinding,
      file: noulFixture(cases),
      provider,
      concurrency: 4,
    });
    expect(max).toBeLessThanOrEqual(4);
    expect(observations).toHaveLength(12);
    expect(observations.map((item) => item.id)).toEqual(cases.map((item) => item.id));
  });

  it("Observation shape", async () => {
    const [observation] = await runCases({
      binding: fullNameBinding,
      file: noulFixture([noulFile.cases[0]!]),
      provider: mockProvider({ answers: () => 0.7, model: "mock" }),
    });
    expect(observation).toMatchObject({
      rule: "full-name",
      language: "en",
      id: "pos-jane",
      expect: "positive",
      probability: 0.7,
      model: "mock",
    });
    expect(typeof observation?.durationMs).toBe("number");
  });

  it("Score observation from mock", async () => {
    const [observation] = await runCases({
      binding: projectDescriptionBinding,
      file: {
        rule: "project-description",
        kind: "score",
        language: "en",
        cases: [{ id: "clear-one", expect: { level: "clear" }, value: "A library" }],
      },
      provider: mockProvider({
        answers: { description: { probabilities: [0.1, 0.1, 0.8], confidence: 0.9 } },
      }),
    });
    expect(observation?.level).toBe("clear");
    expect(observation?.score).toBeCloseTo(1.7, 3);
    expect(observation?.confidence).toBe(0.9);
  });

  it("Provider failure counts as a miss", async () => {
    const observations = await runCases({
      binding: fullNameBinding,
      file: noulFixture([noulFile.cases[0]!]),
      provider: mockProvider({ error: new EDcheckProviderError("http", { status: 500 }) }),
    });
    expect(observations[0]?.error).toBeDefined();
    const misses = countMisses(observations);
    expect(misses).toHaveLength(1);
    expect(misses[0]?.error).toBeDefined();
  });

  it("Ambiguous is recorded only", async () => {
    const observations = await runCases({
      binding: fullNameBinding,
      file: noulFixture([noulFile.cases[2]!]),
      provider: mockProvider({ answers: () => 0.4 }),
    });
    expect(observations).toHaveLength(1);
    expect(observations[0]?.expect).toBe("ambiguous");
    expect(observations[0]?.probability).toBe(0.4);
    expect(countMisses(observations)).toEqual([]);
  });

  it("Positive band", () => {
    const misses = countMisses([
      {
        rule: "full-name",
        language: "en",
        id: "pos-weak",
        expect: "positive",
        probability: DEFAULT_THRESHOLDS.fail - 0.01,
        model: "mock",
        durationMs: 1,
      },
    ]);
    expect(misses).toHaveLength(1);
  });

  it("Negative band", () => {
    const misses = countMisses([
      {
        rule: "full-name",
        language: "en",
        id: "neg-strong",
        expect: "negative",
        probability: DEFAULT_THRESHOLDS.pass,
        model: "mock",
        durationMs: 1,
      },
    ]);
    expect(misses).toHaveLength(1);
  });

  it("Tolerance", () => {
    const one = countMisses([
      {
        rule: "full-name",
        language: "en",
        id: "a",
        expect: "positive",
        probability: 0,
        model: "mock",
        durationMs: 1,
      },
      {
        rule: "full-name",
        language: "en",
        id: "b",
        expect: "positive",
        probability: 0.95,
        model: "mock",
        durationMs: 1,
      },
    ]);
    const two = countMisses([
      {
        rule: "full-name",
        language: "en",
        id: "a",
        expect: "positive",
        probability: 0,
        model: "mock",
        durationMs: 1,
      },
      {
        rule: "full-name",
        language: "en",
        id: "b",
        expect: "positive",
        probability: 0,
        model: "mock",
        durationMs: 1,
      },
    ]);
    expect(one).toHaveLength(1);
    expect(two).toHaveLength(2);
    expect(one.length <= 1).toBe(true);
    expect(two.length <= 1).toBe(false);
  });
});
