import type { SemanticQuestion } from "../providers/types/semantic-question.ts";
import type { SemanticRequest } from "../providers/types/semantic-request.ts";

import { buildCrossFieldQuestion } from "./build-cross-field-question.ts";
import { buildQuestion } from "./build-question.ts";
import { buildState } from "./build-state.ts";
import type { RequestGroup } from "./types/request-group.ts";
import type { StateField } from "./types/state-field.ts";

export function compileRequest(group: RequestGroup): SemanticRequest {
  const questions: Record<string, SemanticQuestion> = {};
  for (const rule of group.rules) {
    questions[rule.ruleId] = buildQuestion(rule.dottedPath, rule.rule);
  }
  for (const binding of group.crossField) {
    questions[binding.ruleId] = buildCrossFieldQuestion(binding.dottedPaths, binding.rule);
  }
  const fields: StateField[] = group.rules.map((rule) => ({
    path: rule.path,
    value: rule.value,
  }));
  for (const binding of group.crossField) {
    for (const [index, path] of binding.paths.entries()) {
      fields.push({ path, value: binding.values[index] });
    }
  }
  return {
    state: buildState(fields, group.context),
    questions,
  };
}
