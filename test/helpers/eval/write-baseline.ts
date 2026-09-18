import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { deriveThresholds } from "../calibration/derive-thresholds.ts";
import type { Observation } from "./types/observation.ts";

const baselinePath = join("test", "eval", "baseline.json");

function observationKey(item: Observation): string {
  return `${item.rule}/${item.language}/${item.id}`;
}

export function writeBaseline(
  baseline: {
    recordedAt?: string;
    provider: string;
    model: string;
    observations: readonly Observation[];
    calibration?: unknown;
  },
  options: {
    env?: NodeJS.ProcessEnv;
    writeFile?: (path: string, contents: string) => void;
    readFile?: (path: string) => string;
    merge?: boolean;
  } = {},
): void {
  const env = options.env ?? process.env;
  if (env.EDCHECK_WRITE_BASELINE !== "1") {
    return;
  }
  const write = options.writeFile ?? writeFileSync;
  let observations = [...baseline.observations];
  let recordedAt = baseline.recordedAt ?? new Date().toISOString();
  let provider = baseline.provider;
  let model = baseline.model;
  if (options.merge !== false) {
    const read = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
    if (existsSync(baselinePath) || options.readFile !== undefined) {
      try {
        const previous = JSON.parse(read(baselinePath)) as {
          recordedAt?: string;
          provider?: string;
          model?: string;
          observations?: Observation[];
        };
        const byKey = new Map<string, Observation>();
        for (const item of previous.observations ?? []) {
          byKey.set(observationKey(item), item);
        }
        for (const item of observations) {
          byKey.set(observationKey(item), item);
        }
        observations = [...byKey.values()];
        recordedAt = previous.recordedAt ?? recordedAt;
        provider = previous.provider ?? provider;
        model = previous.model ?? model;
      } catch {
        // First write, or unreadable previous file.
      }
    }
  }
  let calibration = baseline.calibration;
  try {
    calibration = deriveThresholds(observations);
  } catch {
    // Score-only batches cannot derive Noul thresholds.
  }
  write(
    baselinePath,
    `${JSON.stringify({ recordedAt, provider, model, observations, calibration }, null, 2)}\n`,
  );
}
