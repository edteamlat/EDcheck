import { EDcheckEnvironmentError } from "../errors/edcheck-environment-error.ts";

import { isBrowserEnvironment } from "./is-browser-environment.ts";

export function assertServerEnvironment(): void {
  if (isBrowserEnvironment()) {
    throw new EDcheckEnvironmentError(
      "EDcheck runs on the server only. Call it from your API route, not the browser.",
    );
  }
}
