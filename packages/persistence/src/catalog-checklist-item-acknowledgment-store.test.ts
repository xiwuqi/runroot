import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCrossRunAuditCatalogChecklistItemAcknowledgment } from "@runroot/replay";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createFileAuditCatalogChecklistItemAcknowledgmentStore,
  createPostgresAuditCatalogChecklistItemAcknowledgmentStore,
  createSqliteAuditCatalogChecklistItemAcknowledgmentStore,
  resolveAuditCatalogChecklistItemAcknowledgmentFilePath,
} from "./catalog-checklist-item-acknowledgment-store";

function createAcknowledgment(
  catalogEntryId: string,
  timestamp = "2026-04-02T04:15:00.000Z",
  acknowledgmentNote = "Operator acknowledged that the cited evidence is sufficient",
) {
  return createCrossRunAuditCatalogChecklistItemAcknowledgment({
    acknowledgmentNote,
    catalogEntryId,
    items: [
      {
        item: "Validate queued follow-up",
        state: "acknowledged",
      },
      {
        item: "Close backup handoff",
        state: "unacknowledged",
      },
    ],
    operatorId: "ops_oncall",
    scopeId: "ops",
    timestamp,
  });
}

describe("@runroot/persistence audit catalog checklist item acknowledgment stores", () => {
  it("persists audit catalog checklist item acknowledgment through the Postgres adapter", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const firstStore =
      createPostgresAuditCatalogChecklistItemAcknowledgmentStore({
        pool,
      });
    const secondStore =
      createPostgresAuditCatalogChecklistItemAcknowledgmentStore({
        pool,
      });

    try {
      await firstStore.saveCatalogChecklistItemAcknowledgment(
        createAcknowledgment("catalog_entry_postgres"),
      );

      expect(
        await secondStore.listCatalogChecklistItemAcknowledgments(),
      ).toEqual([createAcknowledgment("catalog_entry_postgres")]);
    } finally {
      await pool.end();
    }
  });

  it("persists audit catalog checklist item acknowledgment through the SQLite adapter", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-acknowledgment-sqlite-"),
    );
    const filePath = join(workspaceRoot, "runroot.sqlite");
    const firstStore = createSqliteAuditCatalogChecklistItemAcknowledgmentStore(
      {
        filePath,
      },
    );
    const secondStore =
      createSqliteAuditCatalogChecklistItemAcknowledgmentStore({
        filePath,
      });

    await firstStore.saveCatalogChecklistItemAcknowledgment(
      createAcknowledgment("catalog_entry_sqlite"),
    );

    expect(await secondStore.listCatalogChecklistItemAcknowledgments()).toEqual(
      [createAcknowledgment("catalog_entry_sqlite")],
    );
  });

  it("persists audit catalog checklist item acknowledgment through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-acknowledgment-file-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemAcknowledgmentStore({
      filePath:
        resolveAuditCatalogChecklistItemAcknowledgmentFilePath(workspacePath),
    });

    await fileStore.saveCatalogChecklistItemAcknowledgment(
      createAcknowledgment("catalog_entry_file"),
    );

    expect(await fileStore.listCatalogChecklistItemAcknowledgments()).toEqual([
      createAcknowledgment("catalog_entry_file"),
    ]);
  });

  it("overwrites and clears audit catalog checklist item acknowledgment through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-acknowledgment-file-overwrite-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemAcknowledgmentStore({
      filePath:
        resolveAuditCatalogChecklistItemAcknowledgmentFilePath(workspacePath),
    });
    const originalEntry = createAcknowledgment("catalog_entry_overwrite");
    const updatedEntry = createAcknowledgment(
      "catalog_entry_overwrite",
      "2026-04-02T04:15:10.000Z",
      "Operator re-acknowledged the evidence after the queued handoff",
    );

    await fileStore.saveCatalogChecklistItemAcknowledgment(originalEntry);
    await fileStore.saveCatalogChecklistItemAcknowledgment(updatedEntry);

    expect(
      await fileStore.getCatalogChecklistItemAcknowledgment(
        "catalog_entry_overwrite",
      ),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemAcknowledgments()).toEqual([
      updatedEntry,
    ]);
    expect(
      await fileStore.deleteCatalogChecklistItemAcknowledgment(
        "catalog_entry_overwrite",
      ),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemAcknowledgments()).toEqual(
      [],
    );
  });
});
