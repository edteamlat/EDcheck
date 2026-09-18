import { EDcheckConfigError } from "../errors/edcheck-config-error.ts";
import { validateThresholds } from "../policy/validate-thresholds.ts";

import type { SemanticRule } from "./types/semantic-rule.ts";
import type { SemanticRuleOptions } from "./types/semantic-rule-options.ts";
import type { Severity } from "./types/severity.ts";

const SEVERITIES = new Set<Severity>(["error", "warning", "info"]);

function requireText(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new EDcheckConfigError(`${label} must be a non-empty string.`, "invalid_rule");
  }
  return value;
}

export function normalizeRule(options: SemanticRuleOptions): SemanticRule {
  const intent = requireText(options.intent, "intent");
  if (options.severity !== undefined && !SEVERITIES.has(options.severity)) {
    throw new EDcheckConfigError(
      `Unknown severity "${String(options.severity)}".`,
      "invalid_option",
    );
  }
  if (options.id !== undefined && options.id.trim().length === 0) {
    throw new EDcheckConfigError("id must be a non-empty string.", "invalid_rule");
  }
  if (options.thresholds !== undefined) {
    validateThresholds(options.thresholds);
  }

  const rule: SemanticRule = {
    kind: "noul",
    intent,
    severity: options.severity ?? "error",
  };
  if (options.valid !== undefined) {
    (rule as { valid: string }).valid = options.valid;
  }
  if (options.invalid !== undefined) {
    (rule as { invalid: string }).invalid = options.invalid;
  }
  if (options.thresholds !== undefined) {
    (rule as { thresholds: Partial<typeof options.thresholds> }).thresholds = Object.freeze({
      ...options.thresholds,
    });
  }
  if (options.message !== undefined) {
    (rule as { message: string }).message = options.message;
  }
  if (options.id !== undefined) {
    (rule as { id: string }).id = options.id;
  }
  return Object.freeze(rule);
}
