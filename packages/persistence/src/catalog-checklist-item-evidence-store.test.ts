import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCrossRunAuditCatalogChecklistItemEvidence } from "@runroot/replay";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createFileAuditCatalogChecklistItemEvidenceStore,
  createPostgresAuditCatalogChecklistItemEvidenceStore,
  createSqliteAuditCatalogChecklistItemEvidenceStore,
  resolveAuditCatalogChecklistItemEvidenceFilePath,
} from "./catalog-checklist-item-evidence-store";

function createEvidence(
  catalogEntryId: string,
  timestamp = "2026-04-02T03:15:00.000Z",
  evidenceNote = "Queued closure confirmed in run audit and handoff log",
) {
  return createCrossRunAuditCatalogChecklistItemEvidence({
    catalogEntryId,
    evidenceNote,
    items: [
      {
        item: "Validate queued follow-up",
        references: ["run://queued-follow-up", "note://backup-handoff"],
      },
      {
        item: "Close backup handoff",
        references: ["doc://backup-closeout"],
      },
    ],
    operatorId: "ops_oncall",
    scopeId: "ops",
    timestamp,
  });
}

describe("@runroot/persistence audit catalog checklist item evidence stores", () => {
  it("persists audit catalog checklist item evidence through the Postgres adapter", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const firstStore = createPostgresAuditCatalogChecklistItemEvidenceStore({
      pool,
    });
    const secondStore = createPostgresAuditCatalogChecklistItemEvidenceStore({
      pool,
    });

    try {
      await firstStore.saveCatalogChecklistItemEvidence(
        createEvidence("catalog_entry_postgres"),
      );

      expect(await secondStore.listCatalogChecklistItemEvidence()).toEqual([
        createEvidence("catalog_entry_postgres"),
      ]);
    } finally {
      await pool.end();
    }
  });

  it("persists audit catalog checklist item evidence through the SQLite adapter", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-evidence-sqlite-"),
    );
    const filePath = join(workspaceRoot, "runroot.sqlite");
    const firstStore = createSqliteAuditCatalogChecklistItemEvidenceStore({
      filePath,
    });
    const secondStore = createSqliteAuditCatalogChecklistItemEvidenceStore({
      filePath,
    });

    await firstStore.saveCatalogChecklistItemEvidence(
      createEvidence("catalog_entry_sqlite"),
    );

    expect(await secondStore.listCatalogChecklistItemEvidence()).toEqual([
      createEvidence("catalog_entry_sqlite"),
    ]);
  });

  it("persists audit catalog checklist item evidence through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-evidence-file-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemEvidenceStore({
      filePath: resolveAuditCatalogChecklistItemEvidenceFilePath(workspacePath),
    });

    await fileStore.saveCatalogChecklistItemEvidence(
      createEvidence("catalog_entry_file"),
    );

    expect(await fileStore.listCatalogChecklistItemEvidence()).toEqual([
      createEvidence("catalog_entry_file"),
    ]);
  });

  it("overwrites and clears audit catalog checklist item evidence through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-evidence-file-overwrite-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemEvidenceStore({
      filePath: resolveAuditCatalogChecklistItemEvidenceFilePath(workspacePath),
    });
    const originalEntry = createEvidence("catalog_entry_overwrite");
    const updatedEntry = createEvidence(
      "catalog_entry_overwrite",
      "2026-04-02T03:15:10.000Z",
      "Queued closure references reconfirmed in the audit trail",
    );

    await fileStore.saveCatalogChecklistItemEvidence(originalEntry);
    await fileStore.saveCatalogChecklistItemEvidence(updatedEntry);

    expect(
      await fileStore.getCatalogChecklistItemEvidence(
        "catalog_entry_overwrite",
      ),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemEvidence()).toEqual([
      updatedEntry,
    ]);
    expect(
      await fileStore.deleteCatalogChecklistItemEvidence(
        "catalog_entry_overwrite",
      ),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemEvidence()).toEqual([]);
  });
});
