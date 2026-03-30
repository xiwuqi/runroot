import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCrossRunAuditCatalogVisibility } from "@runroot/replay";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createFileAuditCatalogVisibilityStore,
  createPostgresAuditCatalogVisibilityStore,
  createSqliteAuditCatalogVisibilityStore,
  resolveAuditCatalogVisibilityFilePath,
} from "./catalog-visibility-store";

function createVisibility(
  catalogEntryId: string,
  state: "personal" | "shared" = "personal",
  timestamp = "2026-03-30T12:00:00.000Z",
) {
  return createCrossRunAuditCatalogVisibility({
    catalogEntryId,
    ownerId: "ops_oncall",
    scopeId: "ops",
    state,
    timestamp,
  });
}

describe("@runroot/persistence audit catalog visibility stores", () => {
  it("persists audit catalog visibility through the Postgres adapter", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const firstStore = createPostgresAuditCatalogVisibilityStore({
      pool,
    });
    const secondStore = createPostgresAuditCatalogVisibilityStore({
      pool,
    });

    try {
      await firstStore.saveCatalogVisibility(
        createVisibility("catalog_entry_postgres", "shared"),
      );

      expect(await secondStore.listCatalogVisibility()).toEqual([
        createVisibility("catalog_entry_postgres", "shared"),
      ]);
    } finally {
      await pool.end();
    }
  });

  it("persists audit catalog visibility through the SQLite adapter", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-visibility-sqlite-"),
    );
    const filePath = join(workspaceRoot, "runroot.sqlite");
    const firstStore = createSqliteAuditCatalogVisibilityStore({
      filePath,
    });
    const secondStore = createSqliteAuditCatalogVisibilityStore({
      filePath,
    });

    await firstStore.saveCatalogVisibility(
      createVisibility("catalog_entry_sqlite"),
    );

    expect(await secondStore.listCatalogVisibility()).toEqual([
      createVisibility("catalog_entry_sqlite"),
    ]);
  });

  it("persists audit catalog visibility through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-visibility-file-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogVisibilityStore({
      filePath: resolveAuditCatalogVisibilityFilePath(workspacePath),
    });

    await fileStore.saveCatalogVisibility(
      createVisibility("catalog_entry_file"),
    );

    expect(await fileStore.listCatalogVisibility()).toEqual([
      createVisibility("catalog_entry_file"),
    ]);
  });

  it("overwrites existing audit catalog visibility through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-visibility-file-overwrite-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogVisibilityStore({
      filePath: resolveAuditCatalogVisibilityFilePath(workspacePath),
    });
    const originalEntry = createVisibility("catalog_entry_overwrite");
    const updatedEntry = createCrossRunAuditCatalogVisibility({
      catalogEntryId: "catalog_entry_overwrite",
      ownerId: "ops_oncall",
      scopeId: "ops",
      state: "shared",
      timestamp: "2026-03-30T12:00:10.000Z",
    });

    await fileStore.saveCatalogVisibility(originalEntry);
    await fileStore.saveCatalogVisibility(updatedEntry);

    expect(
      await fileStore.getCatalogVisibility("catalog_entry_overwrite"),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogVisibility()).toEqual([updatedEntry]);
  });
});
