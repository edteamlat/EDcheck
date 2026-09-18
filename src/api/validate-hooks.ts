import { EDcheckConfigError } from "../errors/edcheck-config-error.ts";

import type { EDcheckHooks } from "./types/edcheck-hooks.ts";

const HOOK_KEYS = new Set(["onRequest", "onResponse", "onError"]);

export function validateHooks(hooks: unknown): EDcheckHooks {
  if (hooks === undefined) {
    return {};
  }
  if (typeof hooks !== "object" || hooks === null || Array.isArray(hooks)) {
    throw new EDcheckConfigError("hooks must be a plain object.", "invalid_option");
  }
  const record = hooks as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!HOOK_KEYS.has(key)) {
      throw new EDcheckConfigError(`Unknown hook "${key}".`, "invalid_option");
    }
    if (typeof record[key] !== "function") {
      throw new EDcheckConfigError(`hooks.${key} must be a function.`, "invalid_option");
    }
  }
  return hooks as EDcheckHooks;
}
