import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import { registry } from "../fixtures/registry.ts";
import { countMisses } from "../helpers/eval/count-misses.ts";
import { describeEval } from "../helpers/eval/describe-eval.ts";
import { formatMiss } from "../helpers/eval/format-miss.ts";
import { resolveEvalProvider } from "../helpers/eval/resolve-eval-provider.ts";
import { runCases } from "../helpers/eval/run-cases.ts";
import type { Observation } from "../helpers/eval/types/observation.ts";
import { writeBaseline } from "../helpers/eval/write-baseline.ts";
import { loadFixture } from "../helpers/fixtures/load-fixture.ts";

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");
const collected: Observation[] = [];

describeEval("score rules eval", () => {
  const maxMisses = Number(process.env.EDCHECK_EVAL_MAX_MISSES ?? 1);

  for (const binding of registry.filter((item) => item.kind === "score")) {
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

  it("merges score observations into the baseline when asked", () => {
    if (process.env.EDCHECK_WRITE_BASELINE !== "1" || collected.length === 0) {
      return;
    }
    const provider = resolveEvalProvider();
    writeBaseline({
      recordedAt: new Date().toISOString(),
      provider: provider.name,
      model: collected[0]?.model ?? "unknown",
      observations: collected,
    });
  });
});
