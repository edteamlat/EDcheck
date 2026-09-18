import type { SemanticQuestion } from "../providers/types/semantic-question.ts";
import type { SemanticRule } from "../rules/types/semantic-rule.ts";

import { buildScoreQuestion } from "./build-score-question.ts";
import { QUESTION_TEMPLATE } from "./question-template.ts";

export function buildQuestion(dottedPath: string, rule: SemanticRule): SemanticQuestion {
  if (rule.kind === "score") {
    return buildScoreQuestion(dottedPath, rule);
  }
  const instructions = QUESTION_TEMPLATE.replace("{path}", dottedPath).replace(
    "{intent}",
    rule.intent,
  );
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
