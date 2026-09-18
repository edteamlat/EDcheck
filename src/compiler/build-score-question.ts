import type { ScoreQuestion } from "../providers/types/score-question.ts";
import type { ScoreRule } from "../rules/types/score-rule.ts";

import { SCORE_QUESTION_TEMPLATE } from "./score-question-template.ts";

export function buildScoreQuestion(dottedPath: string, rule: ScoreRule): ScoreQuestion {
  return {
    type: "score",
    instructions: SCORE_QUESTION_TEMPLATE.replace("{path}", dottedPath).replace(
      "{intent}",
      rule.intent,
    ),
    criteria: rule.levels.map((level) => level.description),
  };
}
