import type { SemanticQuestion } from "../types/semantic-question.ts";

export type GatewayQuestion =
  | { type: "boolean"; instructions: string; criteria?: { true?: string; false?: string } }
  | { type: "score"; instructions: string; criteria: readonly string[] };

export function toGatewayQuestions(
  questions: Record<string, SemanticQuestion>,
): Record<string, GatewayQuestion> {
  const mapped: Record<string, GatewayQuestion> = {};
  for (const [id, question] of Object.entries(questions)) {
    if (question.type === "score") {
      mapped[id] = question;
      continue;
    }
    const booleanQuestion: GatewayQuestion = {
      type: "boolean",
      instructions: question.instructions,
    };
    if (question.criteria !== undefined) {
      booleanQuestion.criteria = question.criteria;
    }
    mapped[id] = booleanQuestion;
  }
  return mapped;
}
