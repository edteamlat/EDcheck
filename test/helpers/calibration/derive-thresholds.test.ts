import { describe, expect, it } from "vitest";

import { deriveThresholds } from "./derive-thresholds.ts";
import type { CalibrationObservation } from "./types/calibration-observation.ts";

function labeled(
  expect: "positive" | "negative" | "ambiguous",
  probabilities: readonly number[],
  prefix: string,
): CalibrationObservation[] {
  return probabilities.map((probability, index) => ({
    id: `${prefix}${index + 1}`,
    expect,
    probability,
  }));
}

describe("Baseline and threshold derivation", () => {
  it("Separable observations", () => {
    const result = deriveThresholds([
      ...labeled("negative", [0.1, 0.31], "n"),
      ...labeled("positive", [0.72, 0.9], "p"),
    ]);
    expect(result).toMatchObject({
      separable: true,
      narrowGap: false,
      fail: 0.4,
      pass: 0.65,
      negativeMax: 0.31,
      positiveMin: 0.72,
    });
  });

  it("Safety invariants hold on the input", () => {
    for (let index = 0; index < 50; index += 1) {
      const split = 0.2 + Math.random() * 0.5;
      const negatives = Array.from({ length: 6 }, () =>
        Number((Math.random() * split).toFixed(3)),
      );
      const positives = Array.from({ length: 6 }, () =>
        Number((split + 0.05 + Math.random() * (0.95 - split - 0.05)).toFixed(3)),
      );
      if (Math.max(...negatives) >= Math.min(...positives)) {
        continue;
      }
      const result = deriveThresholds([
        ...labeled("negative", negatives, `n${index}-`),
        ...labeled("positive", positives, `p${index}-`),
      ]);
      expect(result.separable).toBe(true);
      if (result.separable) {
        for (const probability of negatives) {
          expect(probability).toBeLessThan(result.pass);
        }
        for (const probability of positives) {
          expect(probability).toBeGreaterThanOrEqual(result.fail);
        }
      }
    }
  });

  it("Narrow gap", () => {
    const result = deriveThresholds([
      ...labeled("negative", [0.55], "n"),
      ...labeled("positive", [0.62], "p"),
    ]);
    expect(result).toMatchObject({ fail: 0.55, pass: 0.6, narrowGap: true, separable: true });
  });

  it("Overlap is reported, not resolved", () => {
    const result = deriveThresholds([
      { id: "n1", expect: "negative", probability: 0.2 },
      { id: "n2", expect: "negative", probability: 0.7 },
      { id: "p1", expect: "positive", probability: 0.65 },
      { id: "p2", expect: "positive", probability: 0.9 },
    ]);
    expect(result).toEqual({
      separable: false,
      overlapping: ["p1", "n2"],
      negativeMax: 0.7,
      positiveMin: 0.65,
    });
  });

  it("Grid rounding avoids float drift", () => {
    const result = deriveThresholds([
      ...labeled("negative", [0.3], "n"),
      ...labeled("positive", [0.8], "p"),
    ]);
    expect(result.separable).toBe(true);
    if (result.separable) {
      expect(result.fail).toBe(0.35);
      expect(result.pass).toBe(0.75);
    }
  });

  it("Clamping", () => {
    const result = deriveThresholds([
      ...labeled("negative", [0.01], "n"),
      ...labeled("positive", [0.99], "p"),
    ]);
    expect(result.separable).toBe(true);
    if (result.separable) {
      expect(result.fail).toBe(0.1);
      expect(result.pass).toBe(0.9);
    }
  });

  it("Rates are computed", () => {
    const result = deriveThresholds([
      ...labeled("negative", [0.31], "n"),
      ...labeled("positive", [0.72], "p"),
      ...labeled("ambiguous", [0.5, 0.9], "a"),
    ]);
    expect(result.separable).toBe(true);
    if (result.separable) {
      expect(result.positiveDecisiveRate).toBe(1);
      expect(result.negativeDecisiveRate).toBe(1);
      expect(result.ambiguousInWarningRate).toBe(0.5);
    }
  });

  it("Missing label throws", () => {
    expect(() => deriveThresholds(labeled("positive", [0.9], "p"))).toThrow(/negative/);
    expect(() => deriveThresholds(labeled("negative", [0.1], "n"))).toThrow(/positive/);
  });
});
