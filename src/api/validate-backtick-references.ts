import { EDcheckConfigError } from "../errors/edcheck-config-error.ts";
import { extractBacktickReferences } from "../rules/extract-backtick-references.ts";
import type { SemanticRule } from "../rules/types/semantic-rule.ts";

export function validateBacktickReferences(
  rule: SemanticRule,
  declared: ReadonlySet<string>,
): void {
  const texts = [rule.intent];
  if (rule.valid !== undefined) {
    texts.push(rule.valid);
  }
  if (rule.invalid !== undefined) {
    texts.push(rule.invalid);
  }
  for (const text of texts) {
    for (const token of extractBacktickReferences(text)) {
      if (!declared.has(token)) {
        throw new EDcheckConfigError(
          `Backtick reference \`${token}\` is not a declared path.`,
          "unknown_reference",
        );
      }
    }
  }
}
