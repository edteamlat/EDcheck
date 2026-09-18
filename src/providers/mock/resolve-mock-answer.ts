import type { SemanticQuestion } from "../types/semantic-question.ts";
import type { MockAnswers } from "./types/mock-provider-options.ts";

export function resolveMockAnswer(
  answers: MockAnswers | undefined,
  question: SemanticQuestion,
  id: string,
  defaultAnswer: number,
): number {
  if (answers === undefined) {
    return defaultAnswer;
  }
  if (typeof answers === "function") {
    return answers(question, id);
  }
  return answers[id] ?? defaultAnswer;
}
