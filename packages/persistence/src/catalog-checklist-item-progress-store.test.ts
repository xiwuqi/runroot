import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCrossRunAuditCatalogChecklistItemProgress } from "@runroot/replay";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createFileAuditCatalogChecklistItemProgressStore,
  createPostgresAuditCatalogChecklistItemProgressStore,
  createSqliteAuditCatalogChecklistItemProgressStore,
  resolveAuditCatalogChecklistItemProgressFilePath,
} from "./catalog-checklist-item-progress-store";

function createProgress(
  catalogEntryId: string,
  timestamp = "2026-03-31T02:30:00.000Z",
  completionNote = "Queued follow-up nearly complete",
) {
  return createCrossRunAuditCatalogChecklistItemProgress({
    catalogEntryId,
    completionNote,
    items: [
      {
        item: "Validate queued follow-up",
        state: "completed",
      },
      {
        item: "Close backup handoff",
        state: "pending",
      },
    ],
    operatorId: "ops_oncall",
    scopeId: "ops",
    timestamp,
  });
}

describe("@runroot/persistence audit catalog checklist item progress stores", () => {
  it("persists audit catalog checklist item progress through the Postgres adapter", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const firstStore = createPostgresAuditCatalogChecklistItemProgressStore({
      pool,
    });
    const secondStore = createPostgresAuditCatalogChecklistItemProgressStore({
      pool,
    });

    try {
      await firstStore.saveCatalogChecklistItemProgress(
        createProgress("catalog_entry_postgres"),
      );

      expect(await secondStore.listCatalogChecklistItemProgress()).toEqual([
        createProgress("catalog_entry_postgres"),
      ]);
    } finally {
      await pool.end();
    }
  });

  it("persists audit catalog checklist item progress through the SQLite adapter", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-progress-sqlite-"),
    );
    const filePath = join(workspaceRoot, "runroot.sqlite");
    const firstStore = createSqliteAuditCatalogChecklistItemProgressStore({
      filePath,
    });
    const secondStore = createSqliteAuditCatalogChecklistItemProgressStore({
      filePath,
    });

    await firstStore.saveCatalogChecklistItemProgress(
      createProgress("catalog_entry_sqlite"),
    );

    expect(await secondStore.listCatalogChecklistItemProgress()).toEqual([
      createProgress("catalog_entry_sqlite"),
    ]);
  });

  it("persists audit catalog checklist item progress through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-progress-file-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemProgressStore({
      filePath: resolveAuditCatalogChecklistItemProgressFilePath(workspacePath),
    });

    await fileStore.saveCatalogChecklistItemProgress(
      createProgress("catalog_entry_file"),
    );

    expect(await fileStore.listCatalogChecklistItemProgress()).toEqual([
      createProgress("catalog_entry_file"),
    ]);
  });

  it("overwrites and clears audit catalog checklist item progress through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-progress-file-overwrite-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemProgressStore({
      filePath: resolveAuditCatalogChecklistItemProgressFilePath(workspacePath),
    });
    const originalEntry = createProgress("catalog_entry_overwrite");
    const updatedEntry = createProgress(
      "catalog_entry_overwrite",
      "2026-03-31T02:30:10.000Z",
      "Queued handoff fully closed",
    );

    await fileStore.saveCatalogChecklistItemProgress(originalEntry);
    await fileStore.saveCatalogChecklistItemProgress(updatedEntry);

    expect(
      await fileStore.getCatalogChecklistItemProgress(
        "catalog_entry_overwrite",
      ),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemProgress()).toEqual([
      updatedEntry,
    ]);
    expect(
      await fileStore.deleteCatalogChecklistItemProgress(
        "catalog_entry_overwrite",
      ),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemProgress()).toEqual([]);
  });
});
