import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createEDcheck, mockProvider } from "edcheck";

import { firstPositiveCase } from "../helpers/fixtures/first-positive-case.ts";
import { loadFixture } from "../helpers/fixtures/load-fixture.ts";
import { registry } from "../fixtures/registry.ts";

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");

function fixtureDirs(): string[] {
  return readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

describe("Fixture registry and payload snapshots", () => {
  it("Registry covers every fixture directory", () => {
    const dirs = fixtureDirs();
    const rules = registry.map((binding) => binding.rule).sort();
    expect(rules).toEqual(dirs);
    for (const dir of dirs) {
      expect(registry.some((binding) => binding.rule === dir)).toBe(true);
    }
  });

  it("Binding parses its own positive cases through Zod", () => {
    for (const binding of registry) {
      for (const language of ["es", "en"] as const) {
        const file = loadFixture(join(fixturesRoot, binding.rule, `${language}.json`));
        const positives = file.cases.filter((item) =>
          file.kind === "score" ? typeof item.expect === "object" : item.expect === "positive",
        );
        for (const item of positives) {
          expect(binding.schema.safeParse(binding.toInput(item.value)).success, item.id).toBe(
            true,
          );
        }
      }
    }
  });

  it("Payload snapshot per binding and language", async () => {
    for (const binding of registry) {
      for (const language of ["es", "en"] as const) {
        const file = loadFixture(join(fixturesRoot, binding.rule, `${language}.json`));
        const first = firstPositiveCase(file);
        const provider = mockProvider();
        const schema = binding.define(createEDcheck({ provider }));
        await schema.safeParse(binding.toInput(first.value));
        await expect(provider.calls[0]).toMatchFileSnapshot(
          `__snapshots__/fixture-payloads/${binding.rule}.${language}.json`,
        );
      }
    }
  });

  it("Context binding state", async () => {
    const binding = registry.find((item) => item.rule === "project-name");
    expect(binding).toBeDefined();
    if (binding === undefined) {
      return;
    }
    const file = loadFixture(join(fixturesRoot, "project-name", "en.json"));
    const first = firstPositiveCase(file);
    const provider = mockProvider();
    await binding.define(createEDcheck({ provider })).safeParse(binding.toInput(first.value));
    expect(provider.calls[0]?.state.context).toEqual({
      domain: "enterprise software",
      purpose: "Name of an internal software project",
    });
  });

  it("Cross-field binding state", async () => {
    const binding = registry.find((item) => item.rule === "age-occupation");
    expect(binding).toBeDefined();
    if (binding === undefined) {
      return;
    }
    const file = loadFixture(join(fixturesRoot, "age-occupation", "en.json"));
    const first = firstPositiveCase(file);
    const provider = mockProvider();
    await binding.define(createEDcheck({ provider })).safeParse(binding.toInput(first.value));
    expect(provider.calls[0]?.state).toEqual(first.value);
    expect(Object.keys(provider.calls[0]?.questions ?? {})).toEqual(["age+occupation"]);
  });
});
