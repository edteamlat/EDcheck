import type { SemanticQuestion } from "./semantic-question.ts";

export type SemanticRequest = {
  state: Record<string, unknown>;
  questions: Record<string, SemanticQuestion>;
};
