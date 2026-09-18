import { readFileSync } from "node:fs";

import { z, type ZodIssue } from "zod";

import { fixtureFileSchema } from "./fixture-file-schema.ts";
import type { FixtureCase } from "./types/fixture-case.ts";
import type { FixtureFile } from "./types/fixture-file.ts";

function offendingIds(data: unknown, issues: readonly ZodIssue[]): string[] {
  if (typeof data !== "object" || data === null || !("cases" in data)) {
    return [];
  }
  const cases = (data as { cases?: unknown }).cases;
  if (!Array.isArray(cases)) {
    return [];
  }
  const ids = new Set<string>();
  for (const issue of issues) {
    if (issue.path[0] !== "cases" || typeof issue.path[1] !== "number") {
      continue;
    }
    const item = cases[issue.path[1]];
    if (typeof item === "object" && item !== null && "id" in item && typeof item.id === "string") {
      ids.add(item.id);
    }
  }
  return [...ids];
}

export function loadFixture(filePath: string): FixtureFile {
  const raw: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  const parsed = fixtureFileSchema.safeParse(raw);
  if (parsed.success) {
    return {
      rule: parsed.data.rule,
      kind: parsed.data.kind,
      language: parsed.data.language,
      cases: parsed.data.cases.map((item): FixtureCase => ({
        id: item.id,
        expect: item.expect,
        value: item.value,
        ...(item.tags === undefined ? {} : { tags: item.tags }),
        ...(item.note === undefined ? {} : { note: item.note }),
      })),
    };
  }
  const ids = offendingIds(raw, parsed.error.issues);
  const idNote = ids.length === 0 ? "" : ` (id ${ids.join(", ")})`;
  throw new Error(`Invalid fixture ${filePath}${idNote}: ${z.prettifyError(parsed.error)}`);
}
