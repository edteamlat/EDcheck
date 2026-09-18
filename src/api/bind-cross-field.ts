import type { ZodType } from "zod";

import type { ContextObject } from "../context/types/context-object.ts";
import { EDcheckConfigError } from "../errors/edcheck-config-error.ts";
import { resolveMinConfidence } from "../policy/resolve-min-confidence.ts";
import { resolveThresholds } from "../policy/resolve-thresholds.ts";
import type { Thresholds } from "../policy/types/thresholds.ts";
import type { SemanticRule } from "../rules/types/semantic-rule.ts";
import { isReservedPath } from "../schema/is-reserved-path.ts";
import { resolveNode } from "../schema/resolve-node.ts";
import { parsePath } from "../shared/parse-path.ts";

import { resolveEffectiveContext } from "./resolve-effective-context.ts";
import type { BoundCrossField } from "./types/bound-cross-field.ts";
import type { InstanceConfig } from "./types/instance-config.ts";
import { validateBacktickReferences } from "./validate-backtick-references.ts";

export function bindCrossField(
  schema: ZodType,
  binding: { paths?: readonly string[]; rule?: SemanticRule },
  input: {
    seenIds: Set<string>;
    instance: InstanceConfig;
    schemaContext: ContextObject | undefined;
    schemaThresholds: Partial<Thresholds> | undefined;
    schemaMinConfidence: number | undefined;
  },
): BoundCrossField {
  if (binding.rule === undefined) {
    throw new EDcheckConfigError("crossField binding requires a rule.", "invalid_option");
  }
  const dottedPaths = binding.paths;
  if (dottedPaths === undefined || dottedPaths.length === 0) {
    throw new EDcheckConfigError("crossField paths must be a non-empty list.", "invalid_paths");
  }
  if (new Set(dottedPaths).size !== dottedPaths.length) {
    throw new EDcheckConfigError("crossField paths must be distinct.", "invalid_paths");
  }

  const paths: string[][] = [];
  const nodes: BoundCrossField["nodes"] = [];
  for (const dottedPath of dottedPaths) {
    if (isReservedPath(parsePath(dottedPath))) {
      throw new EDcheckConfigError(
        `Path "${dottedPath}" collides with the reserved state key "context".`,
        "reserved_path",
        { path: dottedPath },
      );
    }
    const resolved = resolveNode(schema, dottedPath, { allowObject: true });
    paths.push(resolved.path);
    nodes.push(resolved.node);
  }

  validateBacktickReferences(binding.rule, new Set(dottedPaths));

  const ruleId = binding.rule.id ?? dottedPaths.join("+");
  if (input.seenIds.has(ruleId)) {
    throw new EDcheckConfigError(`Duplicate rule id "${ruleId}".`, "duplicate_rule_id");
  }
  input.seenIds.add(ruleId);

  const levels: ContextObject[] = [input.instance.context];
  if (input.schemaContext !== undefined) {
    levels.push(input.schemaContext);
  }
  if (binding.rule.context !== undefined) {
    levels.push(binding.rule.context);
  }
  const { context, groupKey } = resolveEffectiveContext(levels);
  return {
    dottedPaths: [...dottedPaths],
    paths,
    nodes,
    rule: binding.rule,
    ruleId,
    thresholds: resolveThresholds({
      instance: input.instance.thresholds,
      schema: input.schemaThresholds,
      rule: binding.rule.kind === "noul" ? binding.rule.thresholds : undefined,
    }),
    minConfidence: resolveMinConfidence({
      rule: binding.rule.kind === "score" ? binding.rule.minConfidence : undefined,
      schema: input.schemaMinConfidence,
      instance: input.instance.minConfidence,
    }),
    effectiveContext: context,
    groupKey,
  };
}
