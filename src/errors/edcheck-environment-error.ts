import { EDcheckError } from "./edcheck-error.ts";

export class EDcheckEnvironmentError extends EDcheckError {
  constructor(message: string) {
    super(message, "browser_environment");
    this.name = "EDcheckEnvironmentError";
  }
}
