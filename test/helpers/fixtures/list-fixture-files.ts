import { readdirSync } from "node:fs";
import { join } from "node:path";

export function listFixtureFiles(fixturesRoot: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(fixturesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const dir = join(fixturesRoot, entry.name);
    for (const language of ["es.json", "en.json"] as const) {
      files.push(join(dir, language));
    }
  }
  return files.sort();
}
