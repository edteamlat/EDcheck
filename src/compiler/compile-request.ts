import type { SemanticQuestion } from "../providers/types/semantic-question.ts";
import type { SemanticRequest } from "../providers/types/semantic-request.ts";

import { buildQuestion } from "./build-question.ts";
import { buildState } from "./build-state.ts";
import type { CompilableRule } from "./types/compilable-rule.ts";

export function compileRequest(rules: readonly CompilableRule[]): SemanticRequest {
  const questions: Record<string, SemanticQuestion> = {};
  for (const rule of rules) {
    questions[rule.ruleId] = buildQuestion(rule.dottedPath, rule.rule);
  }
  return {
    state: buildState(rules.map((rule) => ({ path: rule.path, value: rule.value }))),
    questions,
  };
}
