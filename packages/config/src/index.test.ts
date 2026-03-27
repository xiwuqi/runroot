import { describe, expect, it } from "vitest";

import { projectMetadata, requiredQualityCommands } from "./index";

describe("@runroot/config", () => {
  it("exposes phase-aware project metadata", () => {
    expect(projectMetadata.name).toBe("Runroot");
    expect(projectMetadata.currentPhase).toBe(6);
    expect(projectMetadata.phaseName).toBe(
      "Web Console / Observability Foundations",
    );
  });

  it("lists the required quality commands", () => {
    expect(requiredQualityCommands).toContain("pnpm bootstrap");
    expect(requiredQualityCommands).toContain("pnpm build");
  });
});
