import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createCrossRunAuditCatalogEntry,
  createCrossRunAuditSavedView,
} from "@runroot/replay";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createFileAuditViewCatalogStore,
  createPostgresAuditViewCatalogStore,
  createSqliteAuditViewCatalogStore,
  resolveAuditViewCatalogFilePath,
} from "./catalog-store";

function createSavedView(id: string) {
  return createCrossRunAuditSavedView({
    id,
    name: `Saved view ${id}`,
    navigation: {
      drilldown: {
        workerId: "worker_catalog",
      },
      summary: {
        executionMode: "queued",
      },
    },
    refs: {
      auditViewRunId: "run_queued",
      drilldownRunId: "run_queued",
    },
    timestamp: "2026-03-29T12:00:00.000Z",
  });
}

function createCatalogEntry(
  id: string,
  savedViewId = "saved_view_catalog",
  timestamp = "2026-03-29T12:00:05.000Z",
) {
  return createCrossRunAuditCatalogEntry({
    id,
    savedView: {
      id: savedViewId,
      name: `Saved view ${savedViewId}`,
    },
    timestamp,
  });
}

describe("@runroot/persistence audit view catalog stores", () => {
  it("persists audit view catalogs through the Postgres adapter", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const firstStore = createPostgresAuditViewCatalogStore({
      pool,
    });
    const secondStore = createPostgresAuditViewCatalogStore({
      pool,
    });

    try {
      const savedView = createSavedView("saved_view_catalog");

      await firstStore.saveCatalogEntry(
        createCrossRunAuditCatalogEntry({
          id: "catalog_postgres",
          savedView,
          timestamp: "2026-03-29T12:00:05.000Z",
        }),
      );

      expect(await secondStore.listCatalogEntries()).toEqual([
        createCatalogEntry("catalog_postgres"),
      ]);
    } finally {
      await pool.end();
    }
  });

  it("persists audit view catalogs through the SQLite adapter", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-catalog-sqlite-"),
    );
    const filePath = join(workspaceRoot, "runroot.sqlite");
    const firstStore = createSqliteAuditViewCatalogStore({
      filePath,
    });
    const secondStore = createSqliteAuditViewCatalogStore({
      filePath,
    });

    await firstStore.saveCatalogEntry(createCatalogEntry("catalog_sqlite"));

    expect(await secondStore.listCatalogEntries()).toEqual([
      createCatalogEntry("catalog_sqlite"),
    ]);
  });

  it("persists audit view catalogs through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-catalog-file-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditViewCatalogStore({
      filePath: resolveAuditViewCatalogFilePath(workspacePath),
    });

    await fileStore.saveCatalogEntry(createCatalogEntry("catalog_file"));

    expect(await fileStore.listCatalogEntries()).toEqual([
      createCatalogEntry("catalog_file"),
    ]);
  });

  it("overwrites existing catalog entries through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-catalog-file-overwrite-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditViewCatalogStore({
      filePath: resolveAuditViewCatalogFilePath(workspacePath),
    });
    const originalEntry = createCatalogEntry("catalog_file_overwrite");
    const updatedEntry = createCrossRunAuditCatalogEntry({
      description: "Queued worker preset updated",
      id: "catalog_file_overwrite",
      savedView: {
        description: "Queued worker preset",
        id: "saved_view_catalog",
        name: "Queued worker preset updated",
      },
      timestamp: "2026-03-29T12:00:10.000Z",
    });

    await fileStore.saveCatalogEntry(originalEntry);
    await fileStore.saveCatalogEntry(updatedEntry);

    expect(await fileStore.getCatalogEntry("catalog_file_overwrite")).toEqual(
      updatedEntry,
    );
    expect(await fileStore.listCatalogEntries()).toEqual([updatedEntry]);
  });
});
