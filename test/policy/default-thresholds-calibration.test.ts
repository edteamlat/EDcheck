import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DEFAULT_THRESHOLDS } from "edcheck";

import { deriveThresholds } from "../helpers/calibration/derive-thresholds.ts";
import type { CalibrationObservation } from "../helpers/calibration/types/calibration-observation.ts";
import { registry } from "../fixtures/registry.ts";

const baselinePath = join(dirname(fileURLToPath(import.meta.url)), "../eval/baseline.json");
const hasBaseline = existsSync(baselinePath);

type BaselineObservation = CalibrationObservation & {
  rule: string;
  language: string;
};

type BaselineFile = {
  recordedAt: string;
  provider: string;
  model: string;
  observations: BaselineObservation[];
  calibration: {
    separable: boolean;
    pass?: number;
    fail?: number;
  };
};

function loadBaseline(): BaselineFile {
  return JSON.parse(readFileSync(baselinePath, "utf8")) as BaselineFile;
}

describe("Baseline and threshold derivation", () => {
  it.skipIf(!hasBaseline)("Constant matches the committed baseline", () => {
    const baseline = loadBaseline();
    const derived = deriveThresholds(baseline.observations);
    expect(baseline.calibration.separable).toBe(true);
    expect(derived.separable).toBe(true);
    if (!derived.separable) {
      return;
    }
    expect(baseline.calibration.pass).toBe(derived.pass);
    expect(baseline.calibration.fail).toBe(derived.fail);
    expect(DEFAULT_THRESHOLDS).toEqual({ pass: derived.pass, fail: derived.fail });
  });

  it.skipIf(!hasBaseline)("Baseline provenance", () => {
    const baseline = loadBaseline();
    expect(baseline.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(["typesafe", "gateway"]).toContain(baseline.provider);
    expect(baseline.model.length).toBeGreaterThan(0);
    for (const binding of registry) {
      for (const language of ["en", "es"] as const) {
        expect(
          baseline.observations.some(
            (item) => item.rule === binding.rule && item.language === language,
          ),
          `${binding.rule}/${language}`,
        ).toBe(true);
      }
    }
  });
});
