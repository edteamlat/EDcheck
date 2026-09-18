export class EDcheckError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "EDcheckError";
    this.code = code;
  }
}
