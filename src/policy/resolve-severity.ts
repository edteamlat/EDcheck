import type { Outcome } from "./types/outcome.ts";
import type { Severity } from "../rules/types/severity.ts";

const RANK: Record<Severity, number> = {
  error: 2,
  warning: 1,
  info: 0,
};

export function resolveSeverity(outcome: Outcome, ruleSeverity: Severity): Severity {
  if (outcome === "fail") {
    return ruleSeverity;
  }
  return RANK[ruleSeverity] < RANK.warning ? ruleSeverity : "warning";
}
