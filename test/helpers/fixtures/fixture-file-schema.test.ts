import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadFixture } from "./load-fixture.ts";

const validNoul = {
  rule: "full-name",
  kind: "noul" as const,
  language: "en" as const,
  cases: [
    { id: "pos-hyphenated", expect: "positive" as const, value: "Mary-Anne O'Connor" },
    { id: "neg-keyboard", expect: "negative" as const, value: "asdfasdf" },
    { id: "amb-mononym", expect: "ambiguous" as const, value: "Madonna" },
  ],
};

const validScore = {
  rule: "project-description",
  kind: "score" as const,
  language: "en" as const,
  cases: [
    { id: "clear-library", expect: { level: "clear" }, value: "A TypeScript library." },
    { id: "amb-tool", expect: "ambiguous" as const, value: "A tool for developers." },
  ],
};

function writeSynthetic(name: string, data: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "edcheck-fixture-"));
  const filePath = join(dir, name);
  writeFileSync(filePath, JSON.stringify(data));
  return filePath;
}

describe("Fixture format and coverage", () => {
  it("accepts a valid Noul file", () => {
    const filePath = writeSynthetic("en.json", validNoul);
    const loaded = loadFixture(filePath);
    expect(loaded.kind).toBe("noul");
    expect(loaded.cases).toHaveLength(3);
  });

  it("accepts a valid Score file", () => {
    const filePath = writeSynthetic("en.json", validScore);
    const loaded = loadFixture(filePath);
    expect(loaded.kind).toBe("score");
    expect(loaded.cases[0]?.expect).toEqual({ level: "clear" });
  });

  it("Expect matches the kind", () => {
    const noulWithLevel = writeSynthetic("noul.json", {
      ...validNoul,
      cases: [{ id: "bad-level", expect: { level: "clear" }, value: "Jane Doe" }],
    });
    const scoreWithPositive = writeSynthetic("score.json", {
      ...validScore,
      cases: [{ id: "bad-positive", expect: "positive", value: "A library." }],
    });
    expect(() => loadFixture(noulWithLevel)).toThrow(/noul\.json/);
    expect(() => loadFixture(noulWithLevel)).toThrow(/bad-level/);
    expect(() => loadFixture(scoreWithPositive)).toThrow(/score\.json/);
    expect(() => loadFixture(scoreWithPositive)).toThrow(/bad-positive/);
  });

  it("rejects duplicate ids", () => {
    const filePath = writeSynthetic("dup.json", {
      ...validNoul,
      cases: [
        { id: "same-id", expect: "positive", value: "Jane Doe" },
        { id: "same-id", expect: "negative", value: "asdfasdf" },
      ],
    });
    expect(() => loadFixture(filePath)).toThrow(/dup\.json/);
    expect(() => loadFixture(filePath)).toThrow(/same-id/);
  });

  it("rejects a malformed id", () => {
    const filePath = writeSynthetic("id.json", {
      ...validNoul,
      cases: [{ id: "Bad_ID", expect: "positive", value: "Jane Doe" }],
    });
    expect(() => loadFixture(filePath)).toThrow(/id\.json/);
    expect(() => loadFixture(filePath)).toThrow(/Bad_ID/);
  });

  it("rejects a missing language", () => {
    const withoutLanguage = {
      rule: validNoul.rule,
      kind: validNoul.kind,
      cases: validNoul.cases,
    };
    const filePath = writeSynthetic("nolang.json", withoutLanguage);
    expect(() => loadFixture(filePath)).toThrow(/nolang\.json/);
  });

  it("rejects a null value", () => {
    const filePath = writeSynthetic("null.json", {
      ...validNoul,
      cases: [{ id: "null-value", expect: "positive", value: null }],
    });
    expect(() => loadFixture(filePath)).toThrow(/null\.json/);
    expect(() => loadFixture(filePath)).toThrow(/null-value/);
  });

  it("loadFixture error message contains the path and the offending id", () => {
    const dir = mkdtempSync(join(tmpdir(), "edcheck-fixture-"));
    mkdirSync(join(dir, "nested"), { recursive: true });
    const filePath = join(dir, "nested", "full-name.json");
    writeFileSync(
      filePath,
      JSON.stringify({
        ...validNoul,
        cases: [{ id: "offending-case", expect: { level: "clear" }, value: "Jane" }],
      }),
    );
    expect(() => loadFixture(filePath)).toThrow(/nested\/full-name\.json/);
    expect(() => loadFixture(filePath)).toThrow(/offending-case/);
  });
});
