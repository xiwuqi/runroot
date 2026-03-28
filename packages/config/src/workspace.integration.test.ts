import { approvalsPackageBoundary } from "@runroot/approvals";
import { cliPackageBoundary } from "@runroot/cli";
import { coreRuntimePackageBoundary } from "@runroot/core-runtime";
import { dispatchPackageBoundary } from "@runroot/dispatch";
import { domainPackageBoundary } from "@runroot/domain";
import { eventsPackageBoundary } from "@runroot/events";
import { mcpPackageBoundary } from "@runroot/mcp";
import { observabilityPackageBoundary } from "@runroot/observability";
import { persistencePackageBoundary } from "@runroot/persistence";
import { replayPackageBoundary } from "@runroot/replay";
import { sdkPackageBoundary } from "@runroot/sdk";
import { templatesPackageBoundary } from "@runroot/templates";
import { findDuplicateBoundaryNames } from "@runroot/test-utils";
import { toolsPackageBoundary } from "@runroot/tools";
import { describe, expect, it } from "vitest";

const packageBoundaries = [
  domainPackageBoundary,
  coreRuntimePackageBoundary,
  dispatchPackageBoundary,
  persistencePackageBoundary,
  eventsPackageBoundary,
  toolsPackageBoundary,
  mcpPackageBoundary,
  approvalsPackageBoundary,
  replayPackageBoundary,
  observabilityPackageBoundary,
  sdkPackageBoundary,
  cliPackageBoundary,
  templatesPackageBoundary,
] as const;

describe("workspace boundary registry", () => {
  it("keeps package names unique", () => {
    expect(findDuplicateBoundaryNames(packageBoundaries)).toEqual([]);
  });

  it("documents every package with at least one public surface", () => {
    for (const boundary of packageBoundaries) {
      expect(boundary.publicSurface.length).toBeGreaterThan(0);
    }
  });
});
