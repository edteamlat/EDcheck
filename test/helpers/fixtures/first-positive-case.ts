import type { FixtureCase } from "./types/fixture-case.ts";
import type { FixtureFile } from "./types/fixture-file.ts";

export function firstPositiveCase(file: FixtureFile): FixtureCase {
  const found = file.cases.find((item) => {
    if (file.kind === "score") {
      return typeof item.expect === "object";
    }
    return item.expect === "positive";
  });
  if (found === undefined) {
    throw new Error(`No positive case in ${file.rule}/${file.language}`);
  }
  return found;
}
