import { semantic, type ScoreRule } from "edcheck";

export const PROJECT_DESCRIPTION_INTENT =
  "How well does the description explain the software project?";

export const PROJECT_DESCRIPTION_LEVELS = [
  {
    label: "meaningless",
    description: "Random, spam-like or unrelated text",
    outcome: "fail" as const,
  },
  {
    label: "vague",
    description: "On topic but too vague to act on",
    outcome: "warning" as const,
  },
  {
    label: "clear",
    description: "Explains what to build or which problem to solve",
    outcome: "pass" as const,
  },
] as const;

export function projectDescriptionRule(
  options: {
    minConfidence?: number;
    severity?: ScoreRule["severity"];
    message?: string;
    id?: string;
  } = {},
): ScoreRule {
  return semantic({
    kind: "score",
    intent: PROJECT_DESCRIPTION_INTENT,
    levels: PROJECT_DESCRIPTION_LEVELS,
    ...options,
  });
}
