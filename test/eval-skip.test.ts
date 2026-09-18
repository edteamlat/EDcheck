import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Eval runner skip and provider selection", () => {
  it("Skipped without a key", () => {
    const env = { ...process.env };
    delete env.TYPESAFE_API_KEY;
    delete env.AI_GATEWAY_API_KEY;
    const outputFile = join(mkdtempSync(join(tmpdir(), "edcheck-eval-skip-")), "report.json");
    const result = spawnSync(
      process.execPath,
      [
        join(root, "node_modules/vitest/vitest.mjs"),
        "run",
        "test/eval/noul-rules.eval.test.ts",
        "test/eval/score-rules.eval.test.ts",
        "test/eval/gateway-smoke.eval.test.ts",
        "--reporter=json",
        `--outputFile=${outputFile}`,
        "--typecheck.enabled=false",
      ],
      { cwd: root, env, encoding: "utf8", timeout: 30_000 },
    );
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(
        `eval skip spawn exited ${String(result.status)}: ${result.stderr || result.stdout}`,
      );
    }
    const report = JSON.parse(readFileSync(outputFile, "utf8")) as {
      numFailedTests?: number;
      numPendingTests?: number;
      numSkippedTests?: number;
    };
    expect(report.numFailedTests ?? 1).toBe(0);
    expect((report.numPendingTests ?? 0) + (report.numSkippedTests ?? 0)).toBeGreaterThan(0);
  });
});
