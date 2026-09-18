import { describe, expect, it } from "vitest";
import { z } from "zod";

import { EDcheckConfigError } from "edcheck";

import { collectNodeContexts } from "../../src/api/collect-node-contexts.ts";

const schema = z.object({
  address: z.object({ city: z.string() }),
  tags: z.array(z.string()),
});

describe("collectNodeContexts", () => {
  it("normalizes declared object-node and leaf contexts", () => {
    expect(collectNodeContexts(schema, { address: "shipping", "address.city": "city" })).toEqual(
      new Map([
        ["address", { notes: ["shipping"] }],
        ["address.city", { notes: ["city"] }],
      ]),
    );
  });

  it("rejects an unknown path", () => {
    expect(() => collectNodeContexts(schema, { nickname: "x" })).toThrow(EDcheckConfigError);
  });

  it("rejects an array path", () => {
    expect(() => collectNodeContexts(schema, { tags: "x" })).toThrowError(
      expect.objectContaining({ code: "unsupported_node" }),
    );
  });

  it("rejects a reserved first segment", () => {
    expect(() => collectNodeContexts(schema, { context: "x" })).toThrowError(
      expect.objectContaining({ code: "reserved_path" }),
    );
  });
});
