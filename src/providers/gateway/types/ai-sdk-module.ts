import type * as Ai from "ai";

export type AiSdkModule = {
  experimental_evaluate: typeof Ai.experimental_evaluate;
  APICallError: typeof Ai.APICallError;
  InvalidResponseDataError: typeof Ai.InvalidResponseDataError;
  Experimental_EvaluationUnsupportedQuestionTypeError: typeof Ai.Experimental_EvaluationUnsupportedQuestionTypeError;
  InvalidArgumentError: typeof Ai.InvalidArgumentError;
};
