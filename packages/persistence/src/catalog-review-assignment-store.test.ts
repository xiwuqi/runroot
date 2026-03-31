import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCrossRunAuditCatalogReviewAssignment } from "@runroot/replay";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createFileAuditCatalogReviewAssignmentStore,
  createPostgresAuditCatalogReviewAssignmentStore,
  createSqliteAuditCatalogReviewAssignmentStore,
  resolveAuditCatalogReviewAssignmentsFilePath,
} from "./catalog-review-assignment-store";

function createAssignment(
  catalogEntryId: string,
  assigneeId = "ops_backup",
  timestamp = "2026-03-30T19:00:00.000Z",
  handoffNote = "Queued follow-up for backup on-call",
) {
  return createCrossRunAuditCatalogReviewAssignment({
    assigneeId,
    assignerId: "ops_oncall",
    catalogEntryId,
    handoffNote,
    scopeId: "ops",
    timestamp,
  });
}

describe("@runroot/persistence audit catalog review assignment stores", () => {
  it("persists audit catalog review assignments through the Postgres adapter", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const firstStore = createPostgresAuditCatalogReviewAssignmentStore({
      pool,
    });
    const secondStore = createPostgresAuditCatalogReviewAssignmentStore({
      pool,
    });

    try {
      await firstStore.saveCatalogReviewAssignment(
        createAssignment("catalog_entry_postgres"),
      );

      expect(await secondStore.listCatalogReviewAssignments()).toEqual([
        createAssignment("catalog_entry_postgres"),
      ]);
    } finally {
      await pool.end();
    }
  });

  it("persists audit catalog review assignments through the SQLite adapter", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-assignment-sqlite-"),
    );
    const filePath = join(workspaceRoot, "runroot.sqlite");
    const firstStore = createSqliteAuditCatalogReviewAssignmentStore({
      filePath,
    });
    const secondStore = createSqliteAuditCatalogReviewAssignmentStore({
      filePath,
    });

    await firstStore.saveCatalogReviewAssignment(
      createAssignment("catalog_entry_sqlite"),
    );

    expect(await secondStore.listCatalogReviewAssignments()).toEqual([
      createAssignment("catalog_entry_sqlite"),
    ]);
  });

  it("persists audit catalog review assignments through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-assignment-file-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogReviewAssignmentStore({
      filePath: resolveAuditCatalogReviewAssignmentsFilePath(workspacePath),
    });

    await fileStore.saveCatalogReviewAssignment(
      createAssignment("catalog_entry_file"),
    );

    expect(await fileStore.listCatalogReviewAssignments()).toEqual([
      createAssignment("catalog_entry_file"),
    ]);
  });

  it("overwrites and clears audit catalog review assignments through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-assignment-file-overwrite-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogReviewAssignmentStore({
      filePath: resolveAuditCatalogReviewAssignmentsFilePath(workspacePath),
    });
    const originalEntry = createAssignment("catalog_entry_overwrite");
    const updatedEntry = createAssignment(
      "catalog_entry_overwrite",
      "ops_triage",
      "2026-03-30T19:00:10.000Z",
      "Reassigned to triage for daylight follow-up",
    );

    await fileStore.saveCatalogReviewAssignment(originalEntry);
    await fileStore.saveCatalogReviewAssignment(updatedEntry);

    expect(
      await fileStore.getCatalogReviewAssignment("catalog_entry_overwrite"),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogReviewAssignments()).toEqual([
      updatedEntry,
    ]);
    expect(
      await fileStore.deleteCatalogReviewAssignment("catalog_entry_overwrite"),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogReviewAssignments()).toEqual([]);
  });
});
