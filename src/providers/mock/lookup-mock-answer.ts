import type { SemanticQuestion } from "../types/semantic-question.ts";

import type { MockAnswer } from "./types/mock-answer.ts";
import type { MockAnswers } from "./types/mock-provider-options.ts";

export function lookupMockAnswer(
  answers: MockAnswers | undefined,
  question: SemanticQuestion,
  id: string,
): MockAnswer | undefined {
  if (answers === undefined) {
    return undefined;
  }
  if (typeof answers === "function") {
    return answers(question, id);
  }
  return answers[id];
}
