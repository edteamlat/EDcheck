import type { ScoreAnswer } from "../types/score-answer.ts";
import type { ScoreQuestion } from "../types/score-question.ts";

import type { MockAnswer } from "./types/mock-answer.ts";

export function answerScoreQuestion(
  question: ScoreQuestion,
  configured: MockAnswer | undefined,
): ScoreAnswer {
  if (typeof configured === "number") {
    throw new Error("Score questions require { probabilities, confidence? }, not a number.");
  }
  const levelCount = question.criteria.length;
  const probabilities =
    configured?.probabilities ??
    question.criteria.map((_, index) => (index === levelCount - 1 ? 1 : 0));
  const confidence = configured?.confidence ?? 1;
  let score = 0;
  for (const [index, probability] of probabilities.entries()) {
    score += index * (probability ?? 0);
  }
  return {
    type: "score",
    score,
    probabilities,
    confidence,
  };
}
