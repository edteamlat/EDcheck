import { EDcheckConfigError } from "../errors/edcheck-config-error.ts";
import { resolveThresholds } from "../policy/resolve-thresholds.ts";
import type { FailurePolicy } from "../policy/types/failure-policy.ts";
import { validateThresholds } from "../policy/validate-thresholds.ts";
import { assertServerEnvironment } from "../shared/assert-server-environment.ts";

import { defineSemanticSchema } from "./define-semantic-schema.ts";
import type { EDcheck } from "./types/edcheck.ts";
import type { EDcheckOptions } from "./types/edcheck-options.ts";
import type { InstanceConfig } from "./types/instance-config.ts";

const POLICIES = new Set<FailurePolicy>(["open", "closed"]);

function validateOptions(options: EDcheckOptions): InstanceConfig {
  if (options.provider === undefined || typeof options.provider.evaluate !== "function") {
    throw new EDcheckConfigError("provider is required.", "invalid_option");
  }
  if (options.policy !== undefined && !POLICIES.has(options.policy)) {
    throw new EDcheckConfigError(
      `Unknown policy "${String(options.policy)}".`,
      "invalid_option",
    );
  }
  if (
    options.timeoutMs !== undefined &&
    (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)
  ) {
    throw new EDcheckConfigError("timeoutMs must be a positive number.", "invalid_option");
  }
  if (options.thresholds !== undefined) {
    validateThresholds(options.thresholds);
    resolveThresholds({ instance: options.thresholds });
  }
  return {
    provider: options.provider,
    timeoutMs: options.timeoutMs ?? 10000,
    policy: options.policy ?? "open",
    thresholds: options.thresholds ?? {},
  };
}

export function createEDcheck(options: EDcheckOptions): EDcheck {
  assertServerEnvironment();
  const config = validateOptions(options);
  return {
    define(schema, schemaOptions) {
      return defineSemanticSchema(config, schema, schemaOptions);
    },
  };
}
