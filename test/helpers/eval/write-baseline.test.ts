import { describe, expect, it } from "vitest";

import { writeBaseline } from "./write-baseline.ts";

describe("Baseline and threshold derivation", () => {
  it("Eval writes the baseline only when asked", () => {
    const writes: Array<{ path: string; contents: string }> = [];
    const writer = (path: string, contents: string): void => {
      writes.push({ path, contents });
    };
    const baseline = {
      recordedAt: "2026-09-20T15:04:00Z",
      provider: "typesafe",
      model: "jev-1.13",
      observations: [],
      calibration: { pass: 0.65, fail: 0.4, separable: true },
    };
    writeBaseline(baseline, { env: {}, writeFile: writer });
    expect(writes).toEqual([]);
    writeBaseline(baseline, { env: { EDCHECK_WRITE_BASELINE: "1" }, writeFile: writer });
    expect(writes).toHaveLength(1);
    expect(writes[0]?.path.replaceAll("\\", "/")).toMatch(/test\/eval\/baseline\.json$/);
  });
});
