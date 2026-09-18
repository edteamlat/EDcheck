import type { EDcheckProviderError } from "../../../errors/edcheck-provider-error.ts";
import type { SemanticQuestion } from "../../types/semantic-question.ts";

export type MockAnswers =
  | Record<string, number>
  | ((question: SemanticQuestion, id: string) => number);

export type MockProviderOptions = {
  answers?: MockAnswers;
  defaultAnswer?: number;
  delayMs?: number;
  error?: EDcheckProviderError;
  model?: string;
};
