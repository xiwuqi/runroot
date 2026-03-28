import { describe, expect, it } from "vitest";

import {
  projectMetadata,
  requiredQualityCommands,
  resolvePersistenceConfig,
} from "./index";

describe("@runroot/config", () => {
  it("exposes phase-aware project metadata", () => {
    expect(projectMetadata.name).toBe("Runroot");
    expect(projectMetadata.currentPhase).toBe(8);
    expect(projectMetadata.phaseName).toBe(
      "Postgres-First Persistence and SQLite Development Fallback",
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
});
