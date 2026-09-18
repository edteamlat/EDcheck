import type { EDcheckProviderError } from "../../../errors/edcheck-provider-error.ts";
import type { SemanticQuestion } from "../../types/semantic-question.ts";

import type { MockAnswer } from "./mock-answer.ts";

export type MockAnswers =
  | Record<string, MockAnswer>
  | ((question: SemanticQuestion, id: string) => MockAnswer);

export type MockProviderOptions = {
  answers?: MockAnswers;
  defaultAnswer?: number;
  delayMs?: number;
  error?: EDcheckProviderError;
  model?: string;
};
