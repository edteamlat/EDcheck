import { throwConfigError } from "../shared/throw-config-error.ts";

import type { ContextObject } from "./types/context-object.ts";

const STRING_KEYS = new Set(["domain", "purpose", "audience", "locale", "channel"]);

export function normalizeContext(value: unknown): ContextObject {
  if (typeof value === "string") {
    if (value.trim().length === 0) {
      throwConfigError("Context string must be non-empty.", "invalid_context");
    }
    return { notes: [value] };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throwConfigError("Context must be a string or an object.", "invalid_context");
  }
  const input = value as Record<string, unknown>;
  const output: ContextObject = {};
  for (const [key, entry] of Object.entries(input)) {
    if (entry === undefined) {
      continue;
    }
    if (key === "notes") {
      if (
        !Array.isArray(entry) ||
        entry.some((note) => typeof note !== "string" || note.trim().length === 0)
      ) {
        throwConfigError("notes must be an array of non-empty strings.", "invalid_context");
      }
      output.notes = [...(entry as string[])];
      continue;
    }
    if (STRING_KEYS.has(key) && typeof entry !== "string") {
      throwConfigError(`Reserved context key "${key}" must be a string.`, "invalid_context");
    }
    output[key] = entry;
  }
  return output;
}
