import type { ZodObject } from "zod";

import { EDcheckConfigError } from "../errors/edcheck-config-error.ts";
import { resolveThresholds } from "../policy/resolve-thresholds.ts";
import type { FailurePolicy } from "../policy/types/failure-policy.ts";
import type { SemanticRule } from "../rules/types/semantic-rule.ts";
import { resolveNode } from "../schema/resolve-node.ts";

import { runSafeParse } from "./run-safe-parse.ts";
import type { BoundRule } from "./types/bound-rule.ts";
import type { InstanceConfig } from "./types/instance-config.ts";
import type { SemanticSchema } from "./types/semantic-schema.ts";
import type { SemanticSchemaOptions } from "./types/semantic-schema-options.ts";

const POLICIES = new Set<FailurePolicy>(["open", "closed"]);

export function defineSemanticSchema<S extends ZodObject>(
  instance: InstanceConfig,
  schema: S,
  options: SemanticSchemaOptions<S>,
): SemanticSchema<S> {
  if (schema.type !== "object") {
    throw new EDcheckConfigError(
      "define() requires a Zod object schema.",
      "unsupported_schema",
    );
  }
  if (options.policy !== undefined && !POLICIES.has(options.policy)) {
    throw new EDcheckConfigError(
      `Unknown policy "${String(options.policy)}".`,
      "invalid_option",
    );
  }
  resolveThresholds({ instance: instance.thresholds, schema: options.thresholds });

  const boundRules: BoundRule[] = [];
  const seenIds = new Set<string>();
  const entries = Object.entries(options.rules) as Array<[string, SemanticRule | undefined]>;
  for (const [dottedPath, rule] of entries) {
    if (rule === undefined) {
      continue;
    }
    const resolved = resolveNode(schema, dottedPath);
    const ruleId = rule.id ?? resolved.dottedPath;
    if (seenIds.has(ruleId)) {
      throw new EDcheckConfigError(
        `Duplicate rule id "${ruleId}".`,
        "duplicate_rule_id",
        { path: dottedPath },
      );
    }
    seenIds.add(ruleId);
    const thresholds = resolveThresholds({
      instance: instance.thresholds,
      schema: options.thresholds,
      rule: rule.thresholds,
    });
    boundRules.push({
      dottedPath: resolved.dottedPath,
      path: resolved.path,
      rule,
      ruleId,
      node: resolved.node,
      thresholds,
    });
  }

  const policy = options.policy ?? instance.policy;
  return {
    schema,
    safeParse(data, parseOptions) {
      return runSafeParse({
        schema,
        data,
        boundRules,
        provider: instance.provider,
        timeoutMs: parseOptions?.timeoutMs ?? instance.timeoutMs,
        policy,
        signal: parseOptions?.signal,
      });
    },
  };
}
