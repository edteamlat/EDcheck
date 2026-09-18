import type { SemanticQuestion } from "../providers/types/semantic-question.ts";
import type { SemanticRequest } from "../providers/types/semantic-request.ts";

import { buildQuestion } from "./build-question.ts";
import { buildState } from "./build-state.ts";
import type { RequestGroup } from "./types/request-group.ts";

export function compileRequest(group: RequestGroup): SemanticRequest {
  const questions: Record<string, SemanticQuestion> = {};
  for (const rule of group.rules) {
    questions[rule.ruleId] = buildQuestion(rule.dottedPath, rule.rule);
  }
  return {
    state: buildState(
      group.rules.map((rule) => ({ path: rule.path, value: rule.value })),
      group.context,
    ),
    questions,
  };
}
