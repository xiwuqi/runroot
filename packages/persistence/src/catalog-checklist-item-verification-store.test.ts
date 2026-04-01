import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCrossRunAuditCatalogChecklistItemVerification } from "@runroot/replay";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createFileAuditCatalogChecklistItemVerificationStore,
  createPostgresAuditCatalogChecklistItemVerificationStore,
  createSqliteAuditCatalogChecklistItemVerificationStore,
  resolveAuditCatalogChecklistItemVerificationsFilePath,
} from "./catalog-checklist-item-verification-store";

function createVerification(
  catalogEntryId: string,
  timestamp = "2026-04-01T04:30:00.000Z",
  verificationNote = "Backup confirmed the closeout",
) {
  return createCrossRunAuditCatalogChecklistItemVerification({
    verificationNote,
    catalogEntryId,
    items: [
      {
        item: "Validate queued follow-up",
        state: "verified",
      },
      {
        item: "Close backup handoff",
        state: "unverified",
      },
    ],
    operatorId: "ops_oncall",
    scopeId: "ops",
    timestamp,
  });
}

describe("@runroot/persistence audit catalog checklist item verification stores", () => {
  it("persists audit catalog checklist item verifications through the Postgres adapter", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const firstStore = createPostgresAuditCatalogChecklistItemVerificationStore(
      {
        pool,
      },
    );
    const secondStore =
      createPostgresAuditCatalogChecklistItemVerificationStore({
        pool,
      });

    try {
      await firstStore.saveCatalogChecklistItemVerification(
        createVerification("catalog_entry_postgres"),
      );

      expect(await secondStore.listCatalogChecklistItemVerifications()).toEqual(
        [createVerification("catalog_entry_postgres")],
      );
    } finally {
      await pool.end();
    }
  });

  it("persists audit catalog checklist item verifications through the SQLite adapter", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-verification-sqlite-"),
    );
    const filePath = join(workspaceRoot, "runroot.sqlite");
    const firstStore = createSqliteAuditCatalogChecklistItemVerificationStore({
      filePath,
    });
    const secondStore = createSqliteAuditCatalogChecklistItemVerificationStore({
      filePath,
    });

    await firstStore.saveCatalogChecklistItemVerification(
      createVerification("catalog_entry_sqlite"),
    );

    expect(await secondStore.listCatalogChecklistItemVerifications()).toEqual([
      createVerification("catalog_entry_sqlite"),
    ]);
  });

  it("persists audit catalog checklist item verifications through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-verification-file-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemVerificationStore({
      filePath:
        resolveAuditCatalogChecklistItemVerificationsFilePath(workspacePath),
    });

    await fileStore.saveCatalogChecklistItemVerification(
      createVerification("catalog_entry_file"),
    );

    expect(await fileStore.listCatalogChecklistItemVerifications()).toEqual([
      createVerification("catalog_entry_file"),
    ]);
  });

  it("overwrites and clears audit catalog checklist item verifications through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-verification-file-overwrite-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemVerificationStore({
      filePath:
        resolveAuditCatalogChecklistItemVerificationsFilePath(workspacePath),
    });
    const originalEntry = createVerification("catalog_entry_overwrite");
    const updatedEntry = createVerification(
      "catalog_entry_overwrite",
      "2026-04-01T04:30:10.000Z",
      "Backup reconfirmed one verification remains open",
    );

    await fileStore.saveCatalogChecklistItemVerification(originalEntry);
    await fileStore.saveCatalogChecklistItemVerification(updatedEntry);

    expect(
      await fileStore.getCatalogChecklistItemVerification(
        "catalog_entry_overwrite",
      ),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemVerifications()).toEqual([
      updatedEntry,
    ]);
    expect(
      await fileStore.deleteCatalogChecklistItemVerification(
        "catalog_entry_overwrite",
      ),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemVerifications()).toEqual([]);
  });
});
