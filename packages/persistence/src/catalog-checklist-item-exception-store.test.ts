import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCrossRunAuditCatalogChecklistItemException } from "@runroot/replay";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createFileAuditCatalogChecklistItemExceptionStore,
  createPostgresAuditCatalogChecklistItemExceptionStore,
  createSqliteAuditCatalogChecklistItemExceptionStore,
  resolveAuditCatalogChecklistItemExceptionFilePath,
} from "./catalog-checklist-item-exception-store";

function createException(
  catalogEntryId: string,
  timestamp = "2026-04-04T04:15:00.000Z",
  exceptionNote = "Operator marked the signed-off follow-up as an exception",
) {
  return createCrossRunAuditCatalogChecklistItemException({
    exceptionNote,
    catalogEntryId,
    items: [
      {
        item: "Validate queued follow-up",
        state: "excepted",
      },
      {
        item: "Close backup handoff",
        state: "not-excepted",
      },
    ],
    operatorId: "ops_oncall",
    scopeId: "ops",
    timestamp,
  });
}

describe("@runroot/persistence audit catalog checklist item exception stores", () => {
  it("persists audit catalog checklist item exceptions through the Postgres adapter", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const firstStore = createPostgresAuditCatalogChecklistItemExceptionStore({
      pool,
    });
    const secondStore = createPostgresAuditCatalogChecklistItemExceptionStore({
      pool,
    });

    try {
      await firstStore.saveCatalogChecklistItemException(
        createException("catalog_entry_postgres"),
      );

      expect(await secondStore.listCatalogChecklistItemExceptions()).toEqual([
        createException("catalog_entry_postgres"),
      ]);
    } finally {
      await pool.end();
    }
  });

  it("persists audit catalog checklist item exceptions through the SQLite adapter", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-exception-sqlite-"),
    );
    const filePath = join(workspaceRoot, "runroot.sqlite");
    const firstStore = createSqliteAuditCatalogChecklistItemExceptionStore({
      filePath,
    });
    const secondStore = createSqliteAuditCatalogChecklistItemExceptionStore({
      filePath,
    });

    await firstStore.saveCatalogChecklistItemException(
      createException("catalog_entry_sqlite"),
    );

    expect(await secondStore.listCatalogChecklistItemExceptions()).toEqual([
      createException("catalog_entry_sqlite"),
    ]);
  });

  it("persists audit catalog checklist item exceptions through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-exception-file-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemExceptionStore({
      filePath:
        resolveAuditCatalogChecklistItemExceptionFilePath(workspacePath),
    });

    await fileStore.saveCatalogChecklistItemException(
      createException("catalog_entry_file"),
    );

    expect(await fileStore.listCatalogChecklistItemExceptions()).toEqual([
      createException("catalog_entry_file"),
    ]);
  });

  it("overwrites and clears audit catalog checklist item exceptions through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-exception-file-overwrite-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemExceptionStore({
      filePath:
        resolveAuditCatalogChecklistItemExceptionFilePath(workspacePath),
    });
    const originalEntry = createException("catalog_entry_overwrite");
    const updatedEntry = createException(
      "catalog_entry_overwrite",
      "2026-04-04T04:15:10.000Z",
      "Operator re-recorded the queued closeout exception after sign-off",
    );

    await fileStore.saveCatalogChecklistItemException(originalEntry);
    await fileStore.saveCatalogChecklistItemException(updatedEntry);

    expect(
      await fileStore.getCatalogChecklistItemException(
        "catalog_entry_overwrite",
      ),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemExceptions()).toEqual([
      updatedEntry,
    ]);
    expect(
      await fileStore.deleteCatalogChecklistItemException(
        "catalog_entry_overwrite",
      ),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemExceptions()).toEqual([]);
  });
});
