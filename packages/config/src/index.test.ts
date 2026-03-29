import { describe, expect, it } from "vitest";

import {
  projectMetadata,
  requiredQualityCommands,
  resolveExecutionMode,
  resolvePersistenceConfig,
} from "./index";

describe("@runroot/config", () => {
  it("exposes phase-aware project metadata", () => {
    expect(projectMetadata.name).toBe("Runroot");
    expect(projectMetadata.currentPhase).toBe(11);
    expect(projectMetadata.phaseName).toBe(
      "Correlated Audit Projections and Operator Views",
    );
  });

  it("lists the required quality commands", () => {
    expect(requiredQualityCommands).toContain("pnpm bootstrap");
    expect(requiredQualityCommands).toContain("pnpm build");
  });

  it("defaults to the SQLite fallback when no driver hints exist", () => {
    expect(
      resolvePersistenceConfig({
        env: {},
      }),
    ).toMatchObject({
      driver: "sqlite",
      location: expect.stringContaining(".runroot"),
      sqlitePath: expect.stringContaining("runroot.sqlite"),
    });
  });

  it("prefers the legacy workspace path before DATABASE_URL when no driver is set", () => {
    expect(
      resolvePersistenceConfig({
        env: {
          DATABASE_URL: "postgres://runroot:runroot@localhost:5432/runroot",
          RUNROOT_WORKSPACE_PATH: ".runroot/workspace.json",
        },
      }),
    ).toMatchObject({
      driver: "file",
      workspacePath: expect.stringContaining("workspace.json"),
    });
  });

  it("honors an explicit Postgres driver selection", () => {
    expect(
      resolvePersistenceConfig({
        databaseUrl: "postgres://runroot:runroot@localhost:5432/runroot",
        driver: "postgres",
        env: {},
      }),
    ).toMatchObject({
      databaseUrl: "postgres://runroot:runroot@localhost:5432/runroot",
      driver: "postgres",
    });
  });

  it("defaults execution mode to inline when no queue mode is configured", () => {
    expect(
      resolveExecutionMode({
        env: {},
      }),
    ).toBe("inline");
  });

  it("honors queued execution mode from the environment", () => {
    expect(
      resolveExecutionMode({
        env: {
          RUNROOT_EXECUTION_MODE: "queued",
        },
      }),
    ).toBe("queued");
  });
});
