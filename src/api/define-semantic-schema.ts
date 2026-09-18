import type { output, ZodObject } from "zod";

import { normalizeContext } from "../context/normalize-context.ts";
import type { ContextObject } from "../context/types/context-object.ts";
import { EDcheckConfigError } from "../errors/edcheck-config-error.ts";
import { resolveMinConfidence } from "../policy/resolve-min-confidence.ts";
import { resolveThresholds } from "../policy/resolve-thresholds.ts";
import type { FailurePolicy } from "../policy/types/failure-policy.ts";
import { validateMinConfidence } from "../policy/validate-min-confidence.ts";
import type { SemanticRule } from "../rules/types/semantic-rule.ts";
import { isReservedPath } from "../schema/is-reserved-path.ts";
import { resolveNode } from "../schema/resolve-node.ts";
import { parsePath } from "../shared/parse-path.ts";

import { ancestorContexts } from "./ancestor-contexts.ts";
import { bindCrossField } from "./bind-cross-field.ts";
import { collectNodeContexts } from "./collect-node-contexts.ts";
import { createSemanticNode } from "./create-semantic-node.ts";
import { resolveEffectiveContext } from "./resolve-effective-context.ts";
import { runSafeParse } from "./run-safe-parse.ts";
import type { BoundCrossField } from "./types/bound-cross-field.ts";
import type { BoundRule } from "./types/bound-rule.ts";
import type { InstanceConfig } from "./types/instance-config.ts";
import type { NodePath } from "./types/node-path.ts";
import type { SemanticNode } from "./types/semantic-node.ts";
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
  if (options.minConfidence !== undefined) {
    validateMinConfidence(options.minConfidence);
  }

  const schemaContext: ContextObject | undefined =
    options.context === undefined ? undefined : normalizeContext(options.context);
  const nodeContexts = collectNodeContexts(schema, options.nodeContext);

  const boundRules: BoundRule[] = [];
  const seenIds = new Set<string>();
  const entries = Object.entries(options.rules) as Array<[string, SemanticRule | undefined]>;
  for (const [dottedPath, rule] of entries) {
    if (rule === undefined) {
      continue;
    }
    if (isReservedPath(parsePath(dottedPath))) {
      throw new EDcheckConfigError(
        `Path "${dottedPath}" collides with the reserved state key "context".`,
        "reserved_path",
        { path: dottedPath },
      );
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
      rule: rule.kind === "noul" ? rule.thresholds : undefined,
    });
    const minConfidence = resolveMinConfidence({
      rule: rule.kind === "score" ? rule.minConfidence : undefined,
      schema: options.minConfidence,
      instance: instance.minConfidence,
    });
    const levels: ContextObject[] = [instance.context];
    if (schemaContext !== undefined) {
      levels.push(schemaContext);
    }
    levels.push(...ancestorContexts(resolved.path, nodeContexts));
    if (rule.context !== undefined) {
      levels.push(rule.context);
    }
    const { context, groupKey } = resolveEffectiveContext(levels);
    boundRules.push({
      dottedPath: resolved.dottedPath,
      path: resolved.path,
      rule,
      ruleId,
      node: resolved.node,
      thresholds,
      minConfidence,
      effectiveContext: context,
      groupKey,
    });
  }

  const boundCrossFields: BoundCrossField[] = [];
  for (const binding of options.crossField ?? []) {
    boundCrossFields.push(
      bindCrossField(schema, binding, {
        seenIds,
        instance,
        schemaContext,
        schemaThresholds: options.thresholds,
        schemaMinConfidence: options.minConfidence,
      }),
    );
  }

  const policy = options.policy ?? instance.policy;
  const nodes = new Map<string, SemanticNode<S, NodePath<output<S>>>>();
  return {
    schema,
    safeParse(data, parseOptions) {
      return runSafeParse({
        schema,
        data,
        boundRules,
        boundCrossFields,
        provider: instance.provider,
        timeoutMs: parseOptions?.timeoutMs ?? instance.timeoutMs,
        policy,
        hooks: instance.hooks,
        signal: parseOptions?.signal,
      });
    },
    node(path) {
      const key = String(path);
      const cached = nodes.get(key);
      if (cached !== undefined) {
        return cached as SemanticNode<S, typeof path>;
      }
      const created = createSemanticNode({
        schema,
        path,
        boundRules,
        boundCrossFields,
        instance,
        policy,
      });
      nodes.set(key, created as SemanticNode<S, NodePath<output<S>>>);
      return created;
    },
  };
}
