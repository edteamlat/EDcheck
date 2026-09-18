import { describe, expect, it } from "vitest";

import { mapScoreToOutcome } from "../../src/policy/index.ts";

const outcomes = ["fail", "warning", "pass"] as const;

describe("mapScoreToOutcome", () => {
  it("picks the argmax level", () => {
    expect(
      mapScoreToOutcome({
        probabilities: [0.1, 0.2, 0.7],
        confidence: 0.9,
        outcomes,
        minConfidence: 0.6,
      }),
    ).toEqual({ levelIndex: 2, outcome: "pass" });
  });

  it("resolves a tie to the lowest index", () => {
    expect(
      mapScoreToOutcome({
        probabilities: [0.5, 0.5, 0],
        confidence: 0.9,
        outcomes,
        minConfidence: 0.6,
      }),
    ).toEqual({ levelIndex: 0, outcome: "fail" });
  });

  it("does not pick the middle on a bimodal distribution", () => {
    expect(
      mapScoreToOutcome({
        probabilities: [0.5, 0, 0.5],
        confidence: 0.9,
        outcomes,
        minConfidence: 0.6,
      }),
    ).toEqual({ levelIndex: 0, outcome: "fail" });
  });

  it("maps each winning level to its declared outcome", () => {
    expect(
      mapScoreToOutcome({
        probabilities: [0.8, 0.1, 0.1],
        confidence: 0.9,
        outcomes,
        minConfidence: 0.6,
      }).outcome,
    ).toBe("fail");
    expect(
      mapScoreToOutcome({
        probabilities: [0.2, 0.6, 0.2],
        confidence: 0.9,
        outcomes,
        minConfidence: 0.6,
      }).outcome,
    ).toBe("warning");
  });

  it("gates a fail to warning when confidence is below the minimum", () => {
    expect(
      mapScoreToOutcome({
        probabilities: [0.8, 0.1, 0.1],
        confidence: 0.2,
        outcomes,
        minConfidence: 0.6,
      }),
    ).toEqual({ levelIndex: 0, outcome: "warning" });
  });

  it("gates a pass to warning when confidence is below the minimum", () => {
    expect(
      mapScoreToOutcome({
        probabilities: [0.1, 0.1, 0.8],
        confidence: 0.2,
        outcomes,
        minConfidence: 0.6,
      }),
    ).toEqual({ levelIndex: 2, outcome: "warning" });
  });

  it("keeps the mapped outcome when confidence equals the minimum", () => {
    expect(
      mapScoreToOutcome({
        probabilities: [0.1, 0.1, 0.8],
        confidence: 0.6,
        outcomes,
        minConfidence: 0.6,
      }),
    ).toEqual({ levelIndex: 2, outcome: "pass" });
  });

  it("treats confidence just below the minimum as low", () => {
    expect(
      mapScoreToOutcome({
        probabilities: [0.1, 0.1, 0.8],
        confidence: 0.59,
        outcomes,
        minConfidence: 0.6,
      }),
    ).toEqual({ levelIndex: 2, outcome: "warning" });
  });

  it("disables the gate when minConfidence is 0", () => {
    expect(
      mapScoreToOutcome({
        probabilities: [0.8, 0.1, 0.1],
        confidence: 0,
        outcomes,
        minConfidence: 0,
      }),
    ).toEqual({ levelIndex: 0, outcome: "fail" });
  });
});
