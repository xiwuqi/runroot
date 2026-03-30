import type {
  CrossRunAuditSavedView,
  CrossRunAuditSavedViewApplication,
} from "./saved-view";

export interface CrossRunAuditCatalogEntry {
  readonly archivedAt?: string;
  readonly createdAt: string;
  readonly description?: string;
  readonly id: string;
  readonly kind: "catalog-entry";
  readonly name: string;
  readonly savedViewId: string;
  readonly updatedAt: string;
}

export interface CreateCrossRunAuditCatalogEntryInput {
  readonly description?: string;
  readonly id: string;
  readonly name?: string;
  readonly savedView: Pick<
    CrossRunAuditSavedView,
    "description" | "id" | "name"
  >;
  readonly timestamp: string;
}

export interface PublishCrossRunAuditCatalogEntryInput {
  readonly description?: string;
  readonly id: string;
  readonly name?: string;
  readonly savedViewId: string;
  readonly timestamp: string;
}

export interface CrossRunAuditCatalogEntryView {
  readonly entry: CrossRunAuditCatalogEntry;
  readonly savedView: CrossRunAuditSavedView;
}

export interface CrossRunAuditCatalogEntryCollection {
  readonly items: readonly CrossRunAuditCatalogEntryView[];
  readonly totalCount: number;
}

export interface CrossRunAuditCatalogEntryApplication {
  readonly application: CrossRunAuditSavedViewApplication;
  readonly catalogEntry: CrossRunAuditCatalogEntryView;
}

export interface CrossRunAuditCatalogStore {
  getCatalogEntry(id: string): Promise<CrossRunAuditCatalogEntry | undefined>;
  listCatalogEntries(): Promise<readonly CrossRunAuditCatalogEntry[]>;
  saveCatalogEntry(
    entry: CrossRunAuditCatalogEntry,
  ): Promise<CrossRunAuditCatalogEntry>;
}

export function createCrossRunAuditCatalogEntry(
  input: CreateCrossRunAuditCatalogEntryInput,
): CrossRunAuditCatalogEntry {
  const savedViewId = input.savedView.id.trim();

  if (savedViewId.length === 0) {
    throw new Error("Catalog entries require a saved-view id.");
  }

  const resolvedName = (input.name ?? input.savedView.name).trim();

  if (resolvedName.length === 0) {
    throw new Error("Catalog entries require a non-empty name.");
  }

  const description = (
    input.description ?? input.savedView.description
  )?.trim();

  return {
    createdAt: input.timestamp,
    ...(description ? { description } : {}),
    id: input.id,
    kind: "catalog-entry",
    name: resolvedName,
    savedViewId,
    updatedAt: input.timestamp,
  };
}

export function archiveCrossRunAuditCatalogEntry(
  entry: CrossRunAuditCatalogEntry,
  timestamp: string,
): CrossRunAuditCatalogEntry {
  if (entry.archivedAt) {
    return entry;
  }

  return {
    ...entry,
    archivedAt: timestamp,
    updatedAt: timestamp,
  };
}

export function compareCrossRunAuditCatalogEntries(
  left: CrossRunAuditCatalogEntry,
  right: CrossRunAuditCatalogEntry,
): number {
  return (
    compareArchiveState(left, right) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.name.localeCompare(right.name) ||
    left.id.localeCompare(right.id)
  );
}

function compareArchiveState(
  left: CrossRunAuditCatalogEntry,
  right: CrossRunAuditCatalogEntry,
): number {
  const leftArchived = left.archivedAt ? 1 : 0;
  const rightArchived = right.archivedAt ? 1 : 0;

  return leftArchived - rightArchived;
}
