import { EDcheckError } from "./edcheck-error.ts";

export class EDcheckAbortError extends EDcheckError {
  constructor(message = "Semantic validation was cancelled", options?: { cause?: unknown }) {
    super(message, "aborted");
    this.name = "EDcheckAbortError";
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}
