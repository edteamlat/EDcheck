import type { SemanticAnswer } from "./semantic-answer.ts";
import type { SemanticUsage } from "./semantic-usage.ts";

export type SemanticResponse = {
  model: string;
  answers: Record<string, SemanticAnswer>;
  usage?: SemanticUsage;
};
