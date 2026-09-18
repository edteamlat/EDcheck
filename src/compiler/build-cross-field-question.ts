import type { SemanticQuestion } from "../providers/types/semantic-question.ts";
import type { SemanticRule } from "../rules/types/semantic-rule.ts";
import { formatPathList } from "../shared/format-path-list.ts";

import { CROSS_FIELD_QUESTION_TEMPLATE } from "./cross-field-question-template.ts";

export function buildCrossFieldQuestion(
  dottedPaths: readonly string[],
  rule: SemanticRule,
): SemanticQuestion {
  const instructions = CROSS_FIELD_QUESTION_TEMPLATE.replace(
    "{paths}",
    formatPathList(dottedPaths),
  ).replace("{intent}", rule.intent);
  const question: SemanticQuestion = {
    type: "noul",
    instructions,
  };
  if (rule.valid !== undefined || rule.invalid !== undefined) {
    const criteria: { true?: string; false?: string } = {};
    if (rule.valid !== undefined) {
      criteria.true = rule.valid;
    }
    if (rule.invalid !== undefined) {
      criteria.false = rule.invalid;
    }
    question.criteria = criteria;
  }
  return question;
}
