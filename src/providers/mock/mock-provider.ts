import type { SemanticAnswer } from "../types/semantic-answer.ts";
import type { SemanticRequest } from "../types/semantic-request.ts";
import type { SemanticResponse } from "../types/semantic-response.ts";

import { delayUntil } from "../../shared/delay-until.ts";
import { answerScoreQuestion } from "./answer-score-question.ts";
import { lookupMockAnswer } from "./lookup-mock-answer.ts";
import type { MockProvider } from "./types/mock-provider.ts";
import type { MockProviderOptions } from "./types/mock-provider-options.ts";

export function mockProvider(options: MockProviderOptions = {}): MockProvider {
  const calls: SemanticRequest[] = [];
  const defaultAnswer = options.defaultAnswer ?? 0.9;
  const model = options.model ?? "mock";

  return {
    name: "mock",
    calls,
    async evaluate(
      request: SemanticRequest,
      evaluateOptions: { signal: AbortSignal },
    ): Promise<SemanticResponse> {
      calls.push(request);
      if (options.error !== undefined) {
        throw options.error;
      }
      if (options.delayMs !== undefined && options.delayMs > 0) {
        await delayUntil(options.delayMs, evaluateOptions.signal);
      }
      if (evaluateOptions.signal.aborted) {
        throw evaluateOptions.signal.reason;
      }
      const answers: Record<string, SemanticAnswer> = {};
      for (const [id, question] of Object.entries(request.questions)) {
        const configured = lookupMockAnswer(options.answers, question, id);
        if (question.type === "score") {
          answers[id] = answerScoreQuestion(question, configured);
          continue;
        }
        if (configured !== undefined && typeof configured !== "number") {
          throw new Error("Noul questions require a numeric mock answer.");
        }
        answers[id] = {
          type: "noul",
          noul: configured ?? defaultAnswer,
        };
      }
      return { model, answers };
    },
  };
}
