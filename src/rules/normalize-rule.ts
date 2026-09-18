import { normalizeContext } from "../context/normalize-context.ts";
import { EDcheckConfigError } from "../errors/edcheck-config-error.ts";
import { validateMinConfidence } from "../policy/validate-min-confidence.ts";
import { validateThresholds } from "../policy/validate-thresholds.ts";

import type { NoulRule } from "./types/noul-rule.ts";
import type { NoulRuleOptions } from "./types/noul-rule-options.ts";
import type { ScoreRule } from "./types/score-rule.ts";
import type { ScoreRuleOptions } from "./types/score-rule-options.ts";
import type { SemanticRule } from "./types/semantic-rule.ts";
import type { SemanticRuleOptions } from "./types/semantic-rule-options.ts";
import type { Severity } from "./types/severity.ts";
import { validateLevels } from "./validate-levels.ts";

const SEVERITIES = new Set<Severity>(["error", "warning", "info"]);

function requireText(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new EDcheckConfigError(`${label} must be a non-empty string.`, "invalid_rule");
  }
  return value;
}

function applyCommon<T extends { message?: string; id?: string; context?: unknown }>(
  rule: T,
  options: { severity?: Severity; message?: string; id?: string; context?: unknown },
): void {
  if (options.severity !== undefined && !SEVERITIES.has(options.severity)) {
    throw new EDcheckConfigError(
      `Unknown severity "${String(options.severity)}".`,
      "invalid_option",
    );
  }
  if (options.id !== undefined && options.id.trim().length === 0) {
    throw new EDcheckConfigError("id must be a non-empty string.", "invalid_rule");
  }
  if (options.message !== undefined) {
    (rule as { message: string }).message = options.message;
  }
  if (options.id !== undefined) {
    (rule as { id: string }).id = options.id;
  }
  if (options.context !== undefined) {
    (rule as { context: ReturnType<typeof normalizeContext> }).context = normalizeContext(
      options.context,
    );
  }
}

function normalizeNoulRule(options: NoulRuleOptions): NoulRule {
  if ("levels" in options && options.levels !== undefined) {
    throw new EDcheckConfigError("levels is only valid on score rules.", "invalid_option");
  }
  if ("minConfidence" in options && options.minConfidence !== undefined) {
    throw new EDcheckConfigError(
      "minConfidence is only valid on score rules.",
      "invalid_option",
    );
  }
  if (options.thresholds !== undefined) {
    validateThresholds(options.thresholds);
  }
  const rule: NoulRule = {
    kind: "noul",
    intent: requireText(options.intent, "intent"),
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
  applyCommon(rule, options);
  return Object.freeze(rule);
}

function normalizeScoreRule(options: ScoreRuleOptions): ScoreRule {
  const raw = options as ScoreRuleOptions & {
    thresholds?: unknown;
    valid?: unknown;
    invalid?: unknown;
  };
  if (raw.thresholds !== undefined) {
    throw new EDcheckConfigError("thresholds is only valid on noul rules.", "invalid_option");
  }
  if (raw.valid !== undefined) {
    throw new EDcheckConfigError("valid is only valid on noul rules.", "invalid_option");
  }
  if (raw.invalid !== undefined) {
    throw new EDcheckConfigError("invalid is only valid on noul rules.", "invalid_option");
  }
  if (options.minConfidence !== undefined) {
    validateMinConfidence(options.minConfidence);
  }
  const rule: ScoreRule = {
    kind: "score",
    intent: requireText(options.intent, "intent"),
    severity: options.severity ?? "error",
    levels: Object.freeze(validateLevels(options.levels)),
  };
  if (options.minConfidence !== undefined) {
    (rule as { minConfidence: number }).minConfidence = options.minConfidence;
  }
  applyCommon(rule, options);
  return Object.freeze(rule);
}

export function normalizeRule(options: SemanticRuleOptions): SemanticRule {
  const kind = options.kind ?? "noul";
  if (kind !== "noul" && kind !== "score") {
    throw new EDcheckConfigError(`Unknown rule kind "${String(kind)}".`, "invalid_option");
  }
  if (kind === "score") {
    return normalizeScoreRule(options as ScoreRuleOptions);
  }
  return normalizeNoulRule(options as NoulRuleOptions);
}
