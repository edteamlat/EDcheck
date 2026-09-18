import type { ReservedContextKey } from "./types/reserved-context-key.ts";

export const RESERVED_CONTEXT_KEYS: readonly ReservedContextKey[] = [
  "domain",
  "purpose",
  "audience",
  "locale",
  "channel",
  "notes",
];
