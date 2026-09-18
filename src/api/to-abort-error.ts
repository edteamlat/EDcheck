import { EDcheckAbortError } from "../errors/edcheck-abort-error.ts";

export function toAbortError(reason: unknown): EDcheckAbortError {
  return new EDcheckAbortError("Semantic validation was cancelled", { cause: reason });
}
