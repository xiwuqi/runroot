import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCrossRunAuditCatalogChecklistItemResolution } from "@runroot/replay";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createFileAuditCatalogChecklistItemResolutionStore,
  createPostgresAuditCatalogChecklistItemResolutionStore,
  createSqliteAuditCatalogChecklistItemResolutionStore,
  resolveAuditCatalogChecklistItemResolutionsFilePath,
} from "./catalog-checklist-item-resolution-store";

function createResolution(
  catalogEntryId: string,
  timestamp = "2026-03-31T04:30:00.000Z",
  resolutionNote = "Waiting on backup confirmation before closeout",
) {
  return createCrossRunAuditCatalogChecklistItemResolution({
    resolutionNote,
    catalogEntryId,
    items: [
      {
        item: "Validate queued follow-up",
        state: "unresolved",
      },
      {
        item: "Close backup handoff",
        state: "resolved",
      },
    ],
    operatorId: "ops_oncall",
    scopeId: "ops",
    timestamp,
  });
}

describe("@runroot/persistence audit catalog checklist item resolution stores", () => {
  it("persists audit catalog checklist item resolutions through the Postgres adapter", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const firstStore = createPostgresAuditCatalogChecklistItemResolutionStore({
      pool,
    });
    const secondStore = createPostgresAuditCatalogChecklistItemResolutionStore({
      pool,
    });

    try {
      await firstStore.saveCatalogChecklistItemResolution(
        createResolution("catalog_entry_postgres"),
      );

      expect(await secondStore.listCatalogChecklistItemResolutions()).toEqual([
        createResolution("catalog_entry_postgres"),
      ]);
    } finally {
      await pool.end();
    }
  });

  it("persists audit catalog checklist item resolutions through the SQLite adapter", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-resolution-sqlite-"),
    );
    const filePath = join(workspaceRoot, "runroot.sqlite");
    const firstStore = createSqliteAuditCatalogChecklistItemResolutionStore({
      filePath,
    });
    const secondStore = createSqliteAuditCatalogChecklistItemResolutionStore({
      filePath,
    });

    await firstStore.saveCatalogChecklistItemResolution(
      createResolution("catalog_entry_sqlite"),
    );

    expect(await secondStore.listCatalogChecklistItemResolutions()).toEqual([
      createResolution("catalog_entry_sqlite"),
    ]);
  });

  it("persists audit catalog checklist item resolutions through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-resolution-file-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemResolutionStore({
      filePath:
        resolveAuditCatalogChecklistItemResolutionsFilePath(workspacePath),
    });

    await fileStore.saveCatalogChecklistItemResolution(
      createResolution("catalog_entry_file"),
    );

    expect(await fileStore.listCatalogChecklistItemResolutions()).toEqual([
      createResolution("catalog_entry_file"),
    ]);
  });

  it("overwrites and clears audit catalog checklist item resolutions through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-resolution-file-overwrite-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemResolutionStore({
      filePath:
        resolveAuditCatalogChecklistItemResolutionsFilePath(workspacePath),
    });
    const originalEntry = createResolution("catalog_entry_overwrite");
    const updatedEntry = createResolution(
      "catalog_entry_overwrite",
      "2026-03-31T04:30:10.000Z",
      "Backup confirmation arrived but one resolution remains",
    );

    await fileStore.saveCatalogChecklistItemResolution(originalEntry);
    await fileStore.saveCatalogChecklistItemResolution(updatedEntry);

    expect(
      await fileStore.getCatalogChecklistItemResolution(
        "catalog_entry_overwrite",
      ),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemResolutions()).toEqual([
      updatedEntry,
    ]);
    expect(
      await fileStore.deleteCatalogChecklistItemResolution(
        "catalog_entry_overwrite",
      ),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemResolutions()).toEqual([]);
  });
});
