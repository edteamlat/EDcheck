import { EDcheckConfigError } from "../errors/edcheck-config-error.ts";

export function throwConfigError(
  message: string,
  code: string,
  options?: { path?: string },
): never {
  throw new EDcheckConfigError(message, code, options);
}
