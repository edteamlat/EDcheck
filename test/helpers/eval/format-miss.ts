import type { Miss } from "./types/miss.ts";

function displayValue(value: unknown): string {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  if (raw.length > 60) {
    return `${raw.slice(0, 60)}…`;
  }
  return raw;
}

export function formatMiss(miss: Miss): string {
  const prefix = `[${miss.rule}/${miss.language}/${miss.id}]`;
  if (typeof miss.expect === "object") {
    const observed = miss.level === undefined ? "none" : miss.level;
    return `${prefix} expected level "${miss.expect.level}", observed "${observed}" (score=${miss.score}, confidence=${miss.confidence})`;
  }
  const observed =
    miss.error === undefined
      ? `p=${miss.probability} for "${displayValue(miss.value)}"`
      : `error ${miss.error} for "${displayValue(miss.value)}"`;
  const band = miss.band === undefined ? miss.expect : `${miss.expect} (${miss.band})`;
  return `${prefix} expected ${band}, observed ${observed}`;
}
