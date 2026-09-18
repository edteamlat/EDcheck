import { describe, expect, it } from "vitest";

import pkg from "../package.json";

type PackageJson = {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  exports: Record<string, unknown>;
  browser?: unknown;
};

const manifest: PackageJson = pkg;

describe("package contract (constitution §3, §11)", () => {
  it("declares zod as a peer dependency and never bundles it", () => {
    expect(manifest.peerDependencies?.zod).toBeDefined();
    expect(manifest.dependencies?.zod).toBeUndefined();
  });

  it("exposes a single server entry and no browser build", () => {
    expect(Object.keys(manifest.exports)).toEqual([".", "./package.json"]);
    expect(manifest.browser).toBeUndefined();
  });
});
