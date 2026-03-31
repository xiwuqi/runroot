import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCrossRunAuditCatalogAssignmentChecklist } from "@runroot/replay";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createFileAuditCatalogAssignmentChecklistStore,
  createPostgresAuditCatalogAssignmentChecklistStore,
  createSqliteAuditCatalogAssignmentChecklistStore,
  resolveAuditCatalogAssignmentChecklistsFilePath,
} from "./catalog-assignment-checklist-store";

function createChecklist(
  catalogEntryId: string,
  state: "completed" | "pending" = "pending",
  timestamp = "2026-03-30T21:00:00.000Z",
  items = ["Confirm owner handoff", "Validate queued follow-up"],
) {
  return createCrossRunAuditCatalogAssignmentChecklist({
    catalogEntryId,
    items,
    operatorId: "ops_oncall",
    scopeId: "ops",
    state,
    timestamp,
  });
}

describe("@runroot/persistence audit catalog assignment checklist stores", () => {
  it("persists audit catalog assignment checklists through the Postgres adapter", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const firstStore = createPostgresAuditCatalogAssignmentChecklistStore({
      pool,
    });
    const secondStore = createPostgresAuditCatalogAssignmentChecklistStore({
      pool,
    });

    try {
      await firstStore.saveCatalogAssignmentChecklist(
        createChecklist("catalog_entry_postgres"),
      );

      expect(await secondStore.listCatalogAssignmentChecklists()).toEqual([
        createChecklist("catalog_entry_postgres"),
      ]);
    } finally {
      await pool.end();
    }
  });

  it("persists audit catalog assignment checklists through the SQLite adapter", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-checklist-sqlite-"),
    );
    const filePath = join(workspaceRoot, "runroot.sqlite");
    const firstStore = createSqliteAuditCatalogAssignmentChecklistStore({
      filePath,
    });
    const secondStore = createSqliteAuditCatalogAssignmentChecklistStore({
      filePath,
    });

    await firstStore.saveCatalogAssignmentChecklist(
      createChecklist("catalog_entry_sqlite"),
    );

    expect(await secondStore.listCatalogAssignmentChecklists()).toEqual([
      createChecklist("catalog_entry_sqlite"),
    ]);
  });

  it("persists audit catalog assignment checklists through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-checklist-file-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogAssignmentChecklistStore({
      filePath: resolveAuditCatalogAssignmentChecklistsFilePath(workspacePath),
    });

    await fileStore.saveCatalogAssignmentChecklist(
      createChecklist("catalog_entry_file"),
    );

    expect(await fileStore.listCatalogAssignmentChecklists()).toEqual([
      createChecklist("catalog_entry_file"),
    ]);
  });

  it("overwrites and clears audit catalog assignment checklists through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-checklist-file-overwrite-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogAssignmentChecklistStore({
      filePath: resolveAuditCatalogAssignmentChecklistsFilePath(workspacePath),
    });
    const originalEntry = createChecklist("catalog_entry_overwrite");
    const updatedEntry = createChecklist(
      "catalog_entry_overwrite",
      "completed",
      "2026-03-30T21:00:10.000Z",
      ["Confirm owner handoff", "Close queued follow-up"],
    );

    await fileStore.saveCatalogAssignmentChecklist(originalEntry);
    await fileStore.saveCatalogAssignmentChecklist(updatedEntry);

    expect(
      await fileStore.getCatalogAssignmentChecklist("catalog_entry_overwrite"),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogAssignmentChecklists()).toEqual([
      updatedEntry,
    ]);
    expect(
      await fileStore.deleteCatalogAssignmentChecklist(
        "catalog_entry_overwrite",
      ),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogAssignmentChecklists()).toEqual([]);
  });
});
