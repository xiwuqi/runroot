import type {
  CrossRunAuditCatalogAssignmentChecklistApplication,
  CrossRunAuditCatalogAssignmentChecklistView,
} from "./assignment-checklist";

export type CrossRunAuditCatalogChecklistItemProgressState =
  | "completed"
  | "pending";

export interface CrossRunAuditCatalogChecklistItemProgressItem {
  readonly item: string;
  readonly state: CrossRunAuditCatalogChecklistItemProgressState;
}

export interface CrossRunAuditCatalogChecklistItemProgress {
  readonly catalogEntryId: string;
  readonly completionNote?: string;
  readonly createdAt: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemProgressItem[];
  readonly kind: "catalog-checklist-item-progress";
  readonly operatorId: string;
  readonly scopeId: string;
  readonly updatedAt: string;
}

export interface CreateCrossRunAuditCatalogChecklistItemProgressInput {
  readonly catalogEntryId: string;
  readonly completionNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemProgressItem[];
  readonly operatorId: string;
  readonly scopeId: string;
  readonly timestamp: string;
}

export interface UpdateCrossRunAuditCatalogChecklistItemProgressInput {
  readonly completionNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemProgressItem[];
}

export interface CrossRunAuditCatalogChecklistItemProgressStore {
  deleteCatalogChecklistItemProgress(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemProgress | undefined>;
  getCatalogChecklistItemProgress(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemProgress | undefined>;
  listCatalogChecklistItemProgress(): Promise<
    readonly CrossRunAuditCatalogChecklistItemProgress[]
  >;
  saveCatalogChecklistItemProgress(
    progress: CrossRunAuditCatalogChecklistItemProgress,
  ): Promise<CrossRunAuditCatalogChecklistItemProgress>;
}

export interface CrossRunAuditCatalogChecklistItemProgressView {
  readonly checklist: CrossRunAuditCatalogAssignmentChecklistView;
  readonly progress: CrossRunAuditCatalogChecklistItemProgress;
}

export interface CrossRunAuditCatalogChecklistItemProgressCollection {
  readonly items: readonly CrossRunAuditCatalogChecklistItemProgressView[];
  readonly totalCount: number;
}

export interface CrossRunAuditCatalogChecklistItemProgressApplication {
  readonly application: CrossRunAuditCatalogAssignmentChecklistApplication;
  readonly progress: CrossRunAuditCatalogChecklistItemProgressView;
}

export function createCrossRunAuditCatalogChecklistItemProgress(
  input: CreateCrossRunAuditCatalogChecklistItemProgressInput,
): CrossRunAuditCatalogChecklistItemProgress {
  const catalogEntryId = input.catalogEntryId.trim();
  const operatorId = input.operatorId.trim();
  const scopeId = input.scopeId.trim();
  const items = normalizeChecklistItemProgressItems(input.items);
  const completionNote = normalizeCompletionNote(input.completionNote);

  if (catalogEntryId.length === 0) {
    throw new Error(
      "Catalog checklist item progress requires a catalog entry id.",
    );
  }

  if (operatorId.length === 0) {
    throw new Error("Catalog checklist item progress requires an operator id.");
  }

  if (scopeId.length === 0) {
    throw new Error("Catalog checklist item progress requires a scope id.");
  }

  if (items.length === 0) {
    throw new Error(
      "Catalog checklist item progress requires at least one checklist item progress entry.",
    );
  }

  return {
    catalogEntryId,
    ...(completionNote ? { completionNote } : {}),
    createdAt: input.timestamp,
    items,
    kind: "catalog-checklist-item-progress",
    operatorId,
    scopeId,
    updatedAt: input.timestamp,
  };
}

export function compareCrossRunAuditCatalogChecklistItemProgress(
  left: CrossRunAuditCatalogChecklistItemProgress,
  right: CrossRunAuditCatalogChecklistItemProgress,
): number {
  return (
    compareProgressPriority(left, right) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.catalogEntryId.localeCompare(right.catalogEntryId)
  );
}

export function normalizeChecklistItemProgressItems(
  items: readonly CrossRunAuditCatalogChecklistItemProgressItem[] | undefined,
  allowedItems?: readonly string[],
): readonly CrossRunAuditCatalogChecklistItemProgressItem[] {
  const allowedItemSet = allowedItems
    ? new Set(allowedItems.map((item) => item.trim()).filter(Boolean))
    : undefined;
  const dedupedItems = new Map<
    string,
    CrossRunAuditCatalogChecklistItemProgressState
  >();

  for (const entry of items ?? []) {
    const item = entry.item.trim();

    if (item.length === 0) {
      continue;
    }

    if (entry.state !== "completed" && entry.state !== "pending") {
      throw new Error(
        `Catalog checklist item progress requires state pending|completed for "${item}".`,
      );
    }

    if (allowedItemSet && !allowedItemSet.has(item)) {
      throw new Error(
        `Catalog checklist item progress item "${item}" is not defined on the shared assignment checklist.`,
      );
    }

    dedupedItems.set(item, entry.state);
  }

  return [...dedupedItems.entries()].map(([item, state]) => ({
    item,
    state,
  }));
}

function compareProgressPriority(
  left: CrossRunAuditCatalogChecklistItemProgress,
  right: CrossRunAuditCatalogChecklistItemProgress,
): number {
  const leftPriority = left.items.some((item) => item.state === "pending")
    ? 0
    : 1;
  const rightPriority = right.items.some((item) => item.state === "pending")
    ? 0
    : 1;

  return leftPriority - rightPriority;
}

function normalizeCompletionNote(
  value: string | undefined,
): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}
