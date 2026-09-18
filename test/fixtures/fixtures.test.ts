import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { listFixtureFiles } from "../helpers/fixtures/list-fixture-files.ts";
import { loadFixture } from "../helpers/fixtures/load-fixture.ts";
import type { FixtureFile } from "../helpers/fixtures/types/fixture-file.ts";

const fixturesRoot = dirname(fileURLToPath(import.meta.url));

function stringLength(value: unknown): number {
  if (typeof value === "string") {
    return value.length;
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).reduce(
      (max, field) => Math.max(max, typeof field === "string" ? field.length : 0),
      0,
    );
  }
  return 0;
}

function groupedByRule(files: FixtureFile[]): Map<string, FixtureFile[]> {
  const groups = new Map<string, FixtureFile[]>();
  for (const file of files) {
    const existing = groups.get(file.rule) ?? [];
    existing.push(file);
    groups.set(file.rule, existing);
  }
  return groups;
}

describe("Fixture format and coverage", () => {
  const paths = listFixtureFiles(fixturesRoot);
  const loaded = paths.map((filePath) => ({ filePath, file: loadFixture(filePath) }));

  it("Every fixture file validates", () => {
    for (const { filePath, file } of loaded) {
      expect(file.rule, filePath).toBe(dirname(filePath).split("/").at(-1));
      expect(file.language, filePath).toBe(filePath.endsWith("/es.json") ? "es" : "en");
    }
  });

  it("Ids are unique and well-formed", () => {
    for (const { file } of loaded) {
      const ids = file.cases.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(id).toMatch(/^[a-z0-9-]+$/);
      }
    }
  });

  it("Noul coverage minimums", () => {
    for (const { file } of loaded) {
      if (file.kind !== "noul") {
        continue;
      }
      const positives = file.cases.filter((item) => item.expect === "positive");
      const negatives = file.cases.filter((item) => item.expect === "negative");
      const ambiguous = file.cases.filter((item) => item.expect === "ambiguous");
      expect(positives.length, file.rule + "/" + file.language).toBeGreaterThanOrEqual(6);
      expect(negatives.length, file.rule + "/" + file.language).toBeGreaterThanOrEqual(6);
      expect(ambiguous.length, file.rule + "/" + file.language).toBeGreaterThanOrEqual(2);
    }
  });

  it("Score coverage minimums", () => {
    for (const { file } of loaded) {
      if (file.kind !== "score") {
        continue;
      }
      const levels = new Map<string, number>();
      let ambiguous = 0;
      for (const item of file.cases) {
        if (item.expect === "ambiguous") {
          ambiguous += 1;
          continue;
        }
        if (typeof item.expect === "object") {
          levels.set(item.expect.level, (levels.get(item.expect.level) ?? 0) + 1);
        }
      }
      expect(ambiguous, file.rule + "/" + file.language).toBeGreaterThanOrEqual(2);
      expect(levels.size, file.rule + "/" + file.language).toBeGreaterThan(0);
      for (const [level, count] of levels) {
        expect(count, `${file.rule}/${file.language}/${level}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("Required tags per language", () => {
    for (const { file } of loaded) {
      const tagged = (tag: string): number =>
        file.cases.filter((item) => item.tags?.includes(tag)).length;
      expect(tagged("adversarial"), file.rule + "/" + file.language).toBeGreaterThanOrEqual(2);
      expect(tagged("injection"), file.rule + "/" + file.language).toBeGreaterThanOrEqual(1);
      expect(tagged("rtl"), file.rule + "/" + file.language).toBeGreaterThanOrEqual(1);
    }
  });

  it("Long and emoji cases per rule", () => {
    for (const [rule, files] of groupedByRule(loaded.map((item) => item.file))) {
      const cases = files.flatMap((file) => file.cases);
      expect(
        cases.some((item) => item.tags?.includes("long") && stringLength(item.value) >= 2000),
        rule,
      ).toBe(true);
      expect(
        cases.some((item) => item.tags?.includes("emoji")),
        rule,
      ).toBe(true);
    }
  });

  it("Injection cases are negative", () => {
    for (const { file } of loaded) {
      const injections = file.cases.filter((item) => item.tags?.includes("injection"));
      for (const item of injections) {
        if (file.kind === "noul") {
          expect(item.expect, item.id).toBe("negative");
          continue;
        }
        expect(item.expect, item.id).toEqual({ level: "meaningless" });
      }
    }
  });

  it("Migrated content preserved", () => {
    const fullName = loaded
      .filter((item) => item.file.rule === "full-name")
      .flatMap((item) => item.file.cases);
    const descriptions = loaded
      .filter((item) => item.file.rule === "project-description")
      .flatMap((item) => item.file.cases);
    const ages = loaded
      .filter((item) => item.file.rule === "age-occupation")
      .flatMap((item) => item.file.cases);
    expect(
      fullName.some((item) => item.expect === "negative" && item.value === "asdfasdf"),
    ).toBe(true);
    expect(
      descriptions.some(
        (item) =>
          typeof item.expect === "object" &&
          item.expect.level === "meaningless" &&
          item.value === "a".repeat(60),
      ),
    ).toBe(true);
    expect(
      ages.some(
        (item) =>
          item.expect === "negative" &&
          JSON.stringify(item.value) ===
            JSON.stringify({ age: 7, occupation: "Senior engineer, 15 years experience" }),
      ),
    ).toBe(true);
  });
});
