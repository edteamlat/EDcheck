import { EDcheckError } from "./edcheck-error.ts";

export type ProviderErrorCode =
  | "http"
  | "network"
  | "timeout"
  | "malformed_response"
  | "sdk";

export class EDcheckProviderError extends EDcheckError {
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    code: ProviderErrorCode,
    options?: { status?: number; retryable?: boolean; message?: string; cause?: unknown },
  ) {
    super(options?.message ?? `Provider error: ${code}`, code);
    this.name = "EDcheckProviderError";
    this.retryable = options?.retryable ?? false;
    if (options?.status !== undefined) {
      this.status = options.status;
    }
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}
