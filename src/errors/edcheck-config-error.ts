import { EDcheckError } from "./edcheck-error.ts";

export class EDcheckConfigError extends EDcheckError {
  readonly path?: string;

  constructor(message: string, code: string, options?: { path?: string }) {
    super(message, code);
    this.name = "EDcheckConfigError";
    if (options?.path !== undefined) {
      this.path = options.path;
    }
  }
}
