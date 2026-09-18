import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { registry } from "../fixtures/registry.ts";
import { deriveThresholds } from "../helpers/calibration/derive-thresholds.ts";
import { countMisses } from "../helpers/eval/count-misses.ts";
import { describeEval } from "../helpers/eval/describe-eval.ts";
import { formatMiss } from "../helpers/eval/format-miss.ts";
import { resolveEvalProvider } from "../helpers/eval/resolve-eval-provider.ts";
import { runCases } from "../helpers/eval/run-cases.ts";
import { writeBaseline } from "../helpers/eval/write-baseline.ts";
import type { Observation } from "../helpers/eval/types/observation.ts";
import { loadFixture } from "../helpers/fixtures/load-fixture.ts";

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");

export const noulEvalDeclaredNames: readonly string[] = registry
  .filter((binding) => binding.kind === "noul")
  .flatMap((binding) =>
    (["en", "es"] as const).map((language) => `${binding.rule} (${language})`),
  );

const collected: Observation[] = [];

describe("One test per rule and language", () => {
  it("declares one it per Noul binding × language", () => {
    expect(noulEvalDeclaredNames).toEqual(
      registry
        .filter((binding) => binding.kind === "noul")
        .flatMap((binding) =>
          (["en", "es"] as const).map((language) => `${binding.rule} (${language})`),
        ),
    );
  });
});

describeEval("noul rules eval", () => {
  const maxMisses = Number(process.env.EDCHECK_EVAL_MAX_MISSES ?? 1);

  for (const binding of registry.filter((item) => item.kind === "noul")) {
    for (const language of ["en", "es"] as const) {
      it(`${binding.rule} (${language})`, async () => {
        const provider = resolveEvalProvider();
        const file = loadFixture(join(fixturesRoot, binding.rule, `${language}.json`));
        const observations = await runCases({ binding, file, provider });
        collected.push(...observations);
        const misses = countMisses(observations).map((miss) => {
          const value = file.cases.find((item) => item.id === miss.id)?.value;
          return formatMiss({ ...miss, ...(value === undefined ? {} : { value }) });
        });
        expect(misses, misses.join("\n")).toHaveLength(Math.min(misses.length, maxMisses));
        expect(misses.length).toBeLessThanOrEqual(maxMisses);
      });
    }
  }

  it("writes the baseline when asked", () => {
    if (process.env.EDCHECK_WRITE_BASELINE !== "1" || collected.length === 0) {
      return;
    }
    const provider = resolveEvalProvider();
    const calibration = deriveThresholds(collected);
    writeBaseline({
      recordedAt: new Date().toISOString(),
      provider: provider.name,
      model: collected.find((item) => item.model !== "unknown")?.model ?? "unknown",
      observations: collected,
      calibration,
    });
  });
});
