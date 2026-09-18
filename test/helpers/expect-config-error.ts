import { expect } from "vitest";

import { EDcheckConfigError } from "edcheck";

export function expectConfigError(fn: () => unknown, code: string, path?: string): void {
  try {
    fn();
    expect.fail("expected EDcheckConfigError");
  } catch (error) {
    expect(error).toBeInstanceOf(EDcheckConfigError);
    expect((error as EDcheckConfigError).code).toBe(code);
    if (path !== undefined) {
      expect((error as EDcheckConfigError).path).toBe(path);
    }
  }
}
