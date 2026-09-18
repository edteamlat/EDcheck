import type { output, ZodObject } from "zod";

import { EDcheckConfigError } from "../errors/edcheck-config-error.ts";
import type { FailurePolicy } from "../policy/types/failure-policy.ts";
import { isReservedPath } from "../schema/is-reserved-path.ts";
import { resolveNode } from "../schema/resolve-node.ts";
import { selectRulesUnderPath } from "../schema/select-rules-under-path.ts";
import { parsePath } from "../shared/parse-path.ts";

import { runNodeParse } from "./run-node-parse.ts";
import type { BoundCrossField } from "./types/bound-cross-field.ts";
import type { BoundRule } from "./types/bound-rule.ts";
import type { InstanceConfig } from "./types/instance-config.ts";
import type { NodePath } from "./types/node-path.ts";
import type { SemanticNode } from "./types/semantic-node.ts";

export function createSemanticNode<S extends ZodObject, P extends NodePath<output<S>>>(input: {
  schema: S;
  path: P;
  boundRules: readonly BoundRule[];
  boundCrossFields: readonly BoundCrossField[];
  instance: InstanceConfig;
  policy: FailurePolicy;
}): SemanticNode<S, P> {
  const dottedPath = String(input.path);
  if (dottedPath.length === 0) {
    throw new EDcheckConfigError(`Unknown path "${dottedPath}".`, "unknown_path", {
      path: dottedPath,
    });
  }
  const segments = parsePath(dottedPath);
  if (isReservedPath(segments)) {
    throw new EDcheckConfigError(
      `Path "${dottedPath}" collides with the reserved state key "context".`,
      "reserved_path",
      { path: dottedPath },
    );
  }
  const resolved = resolveNode(input.schema, dottedPath, { allowObject: true });
  const selected = selectRulesUnderPath(
    resolved.path,
    input.boundRules,
    input.boundCrossFields,
  );
  const ruleIds = Object.freeze([
    ...selected.rules.map((rule) => rule.ruleId),
    ...selected.crossField.map((binding) => binding.ruleId),
  ]);
  return {
    path: Object.freeze([...resolved.path]),
    schema: resolved.node,
    ruleIds,
    safeParse(value, options) {
      return runNodeParse({
        node: resolved.node,
        nodePath: resolved.path,
        value,
        boundRules: selected.rules,
        boundCrossFields: selected.crossField,
        provider: input.instance.provider,
        timeoutMs: options?.timeoutMs ?? input.instance.timeoutMs,
        policy: input.policy,
        hooks: input.instance.hooks,
        ...(options === undefined ? {} : { options }),
      });
    },
  };
}
