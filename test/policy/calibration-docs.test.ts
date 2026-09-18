import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DEFAULT_THRESHOLDS } from "edcheck";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const docsPath = join(root, "docs/calibration.md");
const baselinePath = join(root, "test/eval/baseline.json");

describe("Provisional default thresholds", () => {
  it("Provenance is documented", () => {
    const docs = readFileSync(docsPath, "utf8");
    expect(docs).toContain(String(DEFAULT_THRESHOLDS.pass));
    expect(docs).toContain(String(DEFAULT_THRESHOLDS.fail));
    expect(docs).toContain("EDCHECK_WRITE_BASELINE=1 yarn eval");
    if (existsSync(baselinePath)) {
      const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as {
        recordedAt: string;
        model: string;
      };
      expect(docs).toContain(baseline.recordedAt);
      expect(docs).toContain(baseline.model);
    }
  });
});
