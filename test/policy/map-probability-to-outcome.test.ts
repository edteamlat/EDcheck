import { describe, expect, it } from "vitest";

import { mapProbabilityToOutcome } from "../../src/policy/index.ts";

const defaults = { pass: 0.8, fail: 0.5 };

describe("mapProbabilityToOutcome", () => {
  it("maps the default band including inclusive bounds", () => {
    expect(mapProbabilityToOutcome(0.95, defaults)).toBe("pass");
    expect(mapProbabilityToOutcome(0.8, defaults)).toBe("pass");
    expect(mapProbabilityToOutcome(0.79, defaults)).toBe("warning");
    expect(mapProbabilityToOutcome(0.5, defaults)).toBe("warning");
    expect(mapProbabilityToOutcome(0.49, defaults)).toBe("fail");
    expect(mapProbabilityToOutcome(0, defaults)).toBe("fail");
    expect(mapProbabilityToOutcome(1, defaults)).toBe("pass");
  });

  it("collapses the warning band when pass equals fail", () => {
    const collapsed = { pass: 0.7, fail: 0.7 };
    expect(mapProbabilityToOutcome(0.7, collapsed)).toBe("pass");
    expect(mapProbabilityToOutcome(0.69, collapsed)).toBe("fail");
  });
});
