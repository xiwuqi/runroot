import type {
  CrossRunAuditCatalogChecklistItemProgressApplication,
  CrossRunAuditCatalogChecklistItemProgressView,
} from "./checklist-item-progress";

export type CrossRunAuditCatalogChecklistItemBlockerState =
  | "blocked"
  | "cleared";

export interface CrossRunAuditCatalogChecklistItemBlockerItem {
  readonly item: string;
  readonly state: CrossRunAuditCatalogChecklistItemBlockerState;
}

export interface CrossRunAuditCatalogChecklistItemBlocker {
  readonly blockerNote?: string;
  readonly catalogEntryId: string;
  readonly createdAt: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemBlockerItem[];
  readonly kind: "catalog-checklist-item-blocker";
  readonly operatorId: string;
  readonly scopeId: string;
  readonly updatedAt: string;
}

export interface CreateCrossRunAuditCatalogChecklistItemBlockerInput {
  readonly blockerNote?: string;
  readonly catalogEntryId: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemBlockerItem[];
  readonly operatorId: string;
  readonly scopeId: string;
  readonly timestamp: string;
}

export interface UpdateCrossRunAuditCatalogChecklistItemBlockerInput {
  readonly blockerNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemBlockerItem[];
}

export interface CrossRunAuditCatalogChecklistItemBlockerStore {
  deleteCatalogChecklistItemBlocker(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemBlocker | undefined>;
  getCatalogChecklistItemBlocker(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemBlocker | undefined>;
  listCatalogChecklistItemBlockers(): Promise<
    readonly CrossRunAuditCatalogChecklistItemBlocker[]
  >;
  saveCatalogChecklistItemBlocker(
    blocker: CrossRunAuditCatalogChecklistItemBlocker,
  ): Promise<CrossRunAuditCatalogChecklistItemBlocker>;
}

export interface CrossRunAuditCatalogChecklistItemBlockerView {
  readonly blocker: CrossRunAuditCatalogChecklistItemBlocker;
  readonly progress: CrossRunAuditCatalogChecklistItemProgressView;
}

export interface CrossRunAuditCatalogChecklistItemBlockerCollection {
  readonly items: readonly CrossRunAuditCatalogChecklistItemBlockerView[];
  readonly totalCount: number;
}

export interface CrossRunAuditCatalogChecklistItemBlockerApplication {
  readonly application: CrossRunAuditCatalogChecklistItemProgressApplication;
  readonly blocker: CrossRunAuditCatalogChecklistItemBlockerView;
}

export function createCrossRunAuditCatalogChecklistItemBlocker(
  input: CreateCrossRunAuditCatalogChecklistItemBlockerInput,
): CrossRunAuditCatalogChecklistItemBlocker {
  const catalogEntryId = input.catalogEntryId.trim();
  const operatorId = input.operatorId.trim();
  const scopeId = input.scopeId.trim();
  const items = normalizeChecklistItemBlockerItems(input.items);
  const blockerNote = normalizeBlockerNote(input.blockerNote);

  if (catalogEntryId.length === 0) {
    throw new Error(
      "Catalog checklist item blockers require a catalog entry id.",
    );
  }

  if (operatorId.length === 0) {
    throw new Error("Catalog checklist item blockers require an operator id.");
  }

  if (scopeId.length === 0) {
    throw new Error("Catalog checklist item blockers require a scope id.");
  }

  if (items.length === 0) {
    throw new Error(
      "Catalog checklist item blockers require at least one checklist item blocker entry.",
    );
  }

  return {
    ...(blockerNote ? { blockerNote } : {}),
    catalogEntryId,
    createdAt: input.timestamp,
    items,
    kind: "catalog-checklist-item-blocker",
    operatorId,
    scopeId,
    updatedAt: input.timestamp,
  };
}

export function compareCrossRunAuditCatalogChecklistItemBlocker(
  left: CrossRunAuditCatalogChecklistItemBlocker,
  right: CrossRunAuditCatalogChecklistItemBlocker,
): number {
  return (
    compareBlockerPriority(left, right) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.catalogEntryId.localeCompare(right.catalogEntryId)
  );
}

export function normalizeChecklistItemBlockerItems(
  items: readonly CrossRunAuditCatalogChecklistItemBlockerItem[] | undefined,
  allowedItems?: readonly string[],
): readonly CrossRunAuditCatalogChecklistItemBlockerItem[] {
  const allowedItemSet = allowedItems
    ? new Set(allowedItems.map((item) => item.trim()).filter(Boolean))
    : undefined;
  const dedupedItems = new Map<
    string,
    CrossRunAuditCatalogChecklistItemBlockerState
  >();

  for (const entry of items ?? []) {
    const item = entry.item.trim();

    if (item.length === 0) {
      continue;
    }

    if (entry.state !== "blocked" && entry.state !== "cleared") {
      throw new Error(
        `Catalog checklist item blockers require state blocked|cleared for "${item}".`,
      );
    }

    if (allowedItemSet && !allowedItemSet.has(item)) {
      throw new Error(
        `Catalog checklist item blocker "${item}" is not defined on the shared checklist item progress layer.`,
      );
    }

    dedupedItems.set(item, entry.state);
  }

  return [...dedupedItems.entries()].map(([item, state]) => ({
    item,
    state,
  }));
}

function compareBlockerPriority(
  left: CrossRunAuditCatalogChecklistItemBlocker,
  right: CrossRunAuditCatalogChecklistItemBlocker,
): number {
  const leftPriority = left.items.some((item) => item.state === "blocked")
    ? 0
    : 1;
  const rightPriority = right.items.some((item) => item.state === "blocked")
    ? 0
    : 1;

  return leftPriority - rightPriority;
}

function normalizeBlockerNote(value: string | undefined): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}
