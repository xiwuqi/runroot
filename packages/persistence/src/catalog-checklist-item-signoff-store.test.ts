import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCrossRunAuditCatalogChecklistItemSignoff } from "@runroot/replay";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createFileAuditCatalogChecklistItemSignoffStore,
  createPostgresAuditCatalogChecklistItemSignoffStore,
  createSqliteAuditCatalogChecklistItemSignoffStore,
  resolveAuditCatalogChecklistItemSignoffFilePath,
} from "./catalog-checklist-item-signoff-store";

function createSignoff(
  catalogEntryId: string,
  timestamp = "2026-04-02T04:15:00.000Z",
  signoffNote = "Operator signed-off that the cited evidence is sufficient",
) {
  return createCrossRunAuditCatalogChecklistItemSignoff({
    signoffNote,
    catalogEntryId,
    items: [
      {
        item: "Validate queued follow-up",
        state: "signed-off",
      },
      {
        item: "Close backup handoff",
        state: "unsigned",
      },
    ],
    operatorId: "ops_oncall",
    scopeId: "ops",
    timestamp,
  });
}

describe("@runroot/persistence audit catalog checklist item signoff stores", () => {
  it("persists audit catalog checklist item signoff through the Postgres adapter", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const firstStore = createPostgresAuditCatalogChecklistItemSignoffStore({
      pool,
    });
    const secondStore = createPostgresAuditCatalogChecklistItemSignoffStore({
      pool,
    });

    try {
      await firstStore.saveCatalogChecklistItemSignoff(
        createSignoff("catalog_entry_postgres"),
      );

      expect(await secondStore.listCatalogChecklistItemSignoffs()).toEqual([
        createSignoff("catalog_entry_postgres"),
      ]);
    } finally {
      await pool.end();
    }
  });

  it("persists audit catalog checklist item signoff through the SQLite adapter", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-signoff-sqlite-"),
    );
    const filePath = join(workspaceRoot, "runroot.sqlite");
    const firstStore = createSqliteAuditCatalogChecklistItemSignoffStore({
      filePath,
    });
    const secondStore = createSqliteAuditCatalogChecklistItemSignoffStore({
      filePath,
    });

    await firstStore.saveCatalogChecklistItemSignoff(
      createSignoff("catalog_entry_sqlite"),
    );

    expect(await secondStore.listCatalogChecklistItemSignoffs()).toEqual([
      createSignoff("catalog_entry_sqlite"),
    ]);
  });

  it("persists audit catalog checklist item signoff through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-signoff-file-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemSignoffStore({
      filePath: resolveAuditCatalogChecklistItemSignoffFilePath(workspacePath),
    });

    await fileStore.saveCatalogChecklistItemSignoff(
      createSignoff("catalog_entry_file"),
    );

    expect(await fileStore.listCatalogChecklistItemSignoffs()).toEqual([
      createSignoff("catalog_entry_file"),
    ]);
  });

  it("overwrites and clears audit catalog checklist item signoff through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-signoff-file-overwrite-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemSignoffStore({
      filePath: resolveAuditCatalogChecklistItemSignoffFilePath(workspacePath),
    });
    const originalEntry = createSignoff("catalog_entry_overwrite");
    const updatedEntry = createSignoff(
      "catalog_entry_overwrite",
      "2026-04-02T04:15:10.000Z",
      "Operator re-signed-off the evidence after the queued handoff",
    );

    await fileStore.saveCatalogChecklistItemSignoff(originalEntry);
    await fileStore.saveCatalogChecklistItemSignoff(updatedEntry);

    expect(
      await fileStore.getCatalogChecklistItemSignoff("catalog_entry_overwrite"),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemSignoffs()).toEqual([
      updatedEntry,
    ]);
    expect(
      await fileStore.deleteCatalogChecklistItemSignoff(
        "catalog_entry_overwrite",
      ),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemSignoffs()).toEqual([]);
  });
});
