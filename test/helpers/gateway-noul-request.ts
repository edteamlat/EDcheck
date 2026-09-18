import type { SemanticRequest } from "edcheck";

export function gatewayNoulRequest(
  questions: SemanticRequest["questions"] = {
    r1: { type: "noul", instructions: "i", criteria: { true: "t", false: "f" } },
  },
  state: SemanticRequest["state"] = { name: "x" },
): SemanticRequest {
  return { state, questions };
}
