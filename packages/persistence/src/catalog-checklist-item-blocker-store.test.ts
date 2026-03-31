import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCrossRunAuditCatalogChecklistItemBlocker } from "@runroot/replay";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createFileAuditCatalogChecklistItemBlockerStore,
  createPostgresAuditCatalogChecklistItemBlockerStore,
  createSqliteAuditCatalogChecklistItemBlockerStore,
  resolveAuditCatalogChecklistItemBlockersFilePath,
} from "./catalog-checklist-item-blocker-store";

function createBlocker(
  catalogEntryId: string,
  timestamp = "2026-03-31T04:30:00.000Z",
  blockerNote = "Waiting on backup confirmation before closeout",
) {
  return createCrossRunAuditCatalogChecklistItemBlocker({
    blockerNote,
    catalogEntryId,
    items: [
      {
        item: "Validate queued follow-up",
        state: "cleared",
      },
      {
        item: "Close backup handoff",
        state: "blocked",
      },
    ],
    operatorId: "ops_oncall",
    scopeId: "ops",
    timestamp,
  });
}

describe("@runroot/persistence audit catalog checklist item blocker stores", () => {
  it("persists audit catalog checklist item blockers through the Postgres adapter", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const firstStore = createPostgresAuditCatalogChecklistItemBlockerStore({
      pool,
    });
    const secondStore = createPostgresAuditCatalogChecklistItemBlockerStore({
      pool,
    });

    try {
      await firstStore.saveCatalogChecklistItemBlocker(
        createBlocker("catalog_entry_postgres"),
      );

      expect(await secondStore.listCatalogChecklistItemBlockers()).toEqual([
        createBlocker("catalog_entry_postgres"),
      ]);
    } finally {
      await pool.end();
    }
  });

  it("persists audit catalog checklist item blockers through the SQLite adapter", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-blocker-sqlite-"),
    );
    const filePath = join(workspaceRoot, "runroot.sqlite");
    const firstStore = createSqliteAuditCatalogChecklistItemBlockerStore({
      filePath,
    });
    const secondStore = createSqliteAuditCatalogChecklistItemBlockerStore({
      filePath,
    });

    await firstStore.saveCatalogChecklistItemBlocker(
      createBlocker("catalog_entry_sqlite"),
    );

    expect(await secondStore.listCatalogChecklistItemBlockers()).toEqual([
      createBlocker("catalog_entry_sqlite"),
    ]);
  });

  it("persists audit catalog checklist item blockers through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-blocker-file-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemBlockerStore({
      filePath: resolveAuditCatalogChecklistItemBlockersFilePath(workspacePath),
    });

    await fileStore.saveCatalogChecklistItemBlocker(
      createBlocker("catalog_entry_file"),
    );

    expect(await fileStore.listCatalogChecklistItemBlockers()).toEqual([
      createBlocker("catalog_entry_file"),
    ]);
  });

  it("overwrites and clears audit catalog checklist item blockers through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-blocker-file-overwrite-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemBlockerStore({
      filePath: resolveAuditCatalogChecklistItemBlockersFilePath(workspacePath),
    });
    const originalEntry = createBlocker("catalog_entry_overwrite");
    const updatedEntry = createBlocker(
      "catalog_entry_overwrite",
      "2026-03-31T04:30:10.000Z",
      "Backup confirmation arrived but one blocker remains",
    );

    await fileStore.saveCatalogChecklistItemBlocker(originalEntry);
    await fileStore.saveCatalogChecklistItemBlocker(updatedEntry);

    expect(
      await fileStore.getCatalogChecklistItemBlocker("catalog_entry_overwrite"),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemBlockers()).toEqual([
      updatedEntry,
    ]);
    expect(
      await fileStore.deleteCatalogChecklistItemBlocker(
        "catalog_entry_overwrite",
      ),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemBlockers()).toEqual([]);
  });
});
