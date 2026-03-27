import { describe, expect, it } from "vitest";

import { projectMetadata, requiredQualityCommands } from "./index";

describe("@runroot/config", () => {
  it("exposes phase-aware project metadata", () => {
    expect(projectMetadata.name).toBe("Runroot");
    expect(projectMetadata.currentPhase).toBe(5);
    expect(projectMetadata.phaseName).toBe("API / CLI / Templates");
  });

  it("lists the required quality commands", () => {
    expect(requiredQualityCommands).toContain("pnpm bootstrap");
    expect(requiredQualityCommands).toContain("pnpm build");
  });
});
