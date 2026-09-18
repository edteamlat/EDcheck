import type { Outcome } from "../policy/types/outcome.ts";
import type { SemanticResponse } from "../providers/types/semantic-response.ts";

import type { ExecutableCrossField } from "./collect-executable-cross-fields.ts";
import type { ExecutableRule } from "./collect-executable-rules.ts";
import { resolveAnswerOutcome } from "./resolve-answer-outcome.ts";

export function mapOutcomes(
  rules: readonly ExecutableRule[],
  response: SemanticResponse,
  crossField: readonly ExecutableCrossField[] = [],
): Readonly<Record<string, Outcome>> {
  const outcomes: Record<string, Outcome> = {};
  for (const rule of rules) {
    const outcome = resolveAnswerOutcome(rule, response.answers[rule.ruleId]);
    if (outcome !== undefined) {
      outcomes[rule.ruleId] = outcome;
    }
  }
  for (const binding of crossField) {
    const outcome = resolveAnswerOutcome(binding, response.answers[binding.ruleId]);
    if (outcome !== undefined) {
      outcomes[binding.ruleId] = outcome;
    }
  }
  return outcomes;
}
