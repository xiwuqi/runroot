import type { PackageBoundary } from "@runroot/config";
import { describe, expect, it } from "vitest";

import { findDuplicateBoundaryNames } from "./index";

const sampleBoundary = (name: `@runroot/${string}`): PackageBoundary => ({
  name,
  kind: "package",
  phaseOwned: 1,
  responsibility: "test boundary",
  publicSurface: ["test"],
});

describe("@runroot/test-utils", () => {
  it("returns an empty list when names are unique", () => {
    expect(
      findDuplicateBoundaryNames([
        sampleBoundary("@runroot/a"),
        sampleBoundary("@runroot/b"),
      ]),
    ).toEqual([]);
  });

  it("returns duplicate names in sorted order", () => {
    expect(
      findDuplicateBoundaryNames([
        sampleBoundary("@runroot/b"),
        sampleBoundary("@runroot/a"),
        sampleBoundary("@runroot/a"),
        sampleBoundary("@runroot/b"),
      ]),
    ).toEqual(["@runroot/a", "@runroot/b"]);
  });
});
