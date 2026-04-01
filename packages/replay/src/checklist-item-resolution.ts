import type {
  CrossRunAuditCatalogChecklistItemBlockerApplication,
  CrossRunAuditCatalogChecklistItemBlockerView,
} from "./checklist-item-blocker";

export type CrossRunAuditCatalogChecklistItemResolutionState =
  | "resolved"
  | "unresolved";

export interface CrossRunAuditCatalogChecklistItemResolutionItem {
  readonly item: string;
  readonly state: CrossRunAuditCatalogChecklistItemResolutionState;
}

export interface CrossRunAuditCatalogChecklistItemResolution {
  readonly resolutionNote?: string;
  readonly catalogEntryId: string;
  readonly createdAt: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemResolutionItem[];
  readonly kind: "catalog-checklist-item-resolution";
  readonly operatorId: string;
  readonly scopeId: string;
  readonly updatedAt: string;
}

export interface CreateCrossRunAuditCatalogChecklistItemResolutionInput {
  readonly resolutionNote?: string;
  readonly catalogEntryId: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemResolutionItem[];
  readonly operatorId: string;
  readonly scopeId: string;
  readonly timestamp: string;
}

export interface UpdateCrossRunAuditCatalogChecklistItemResolutionInput {
  readonly resolutionNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemResolutionItem[];
}

export interface CrossRunAuditCatalogChecklistItemResolutionStore {
  deleteCatalogChecklistItemResolution(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemResolution | undefined>;
  getCatalogChecklistItemResolution(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemResolution | undefined>;
  listCatalogChecklistItemResolutions(): Promise<
    readonly CrossRunAuditCatalogChecklistItemResolution[]
  >;
  saveCatalogChecklistItemResolution(
    resolution: CrossRunAuditCatalogChecklistItemResolution,
  ): Promise<CrossRunAuditCatalogChecklistItemResolution>;
}

export interface CrossRunAuditCatalogChecklistItemResolutionView {
  readonly blocker: CrossRunAuditCatalogChecklistItemBlockerView;
  readonly resolution: CrossRunAuditCatalogChecklistItemResolution;
}

export interface CrossRunAuditCatalogChecklistItemResolutionCollection {
  readonly items: readonly CrossRunAuditCatalogChecklistItemResolutionView[];
  readonly totalCount: number;
}

export interface CrossRunAuditCatalogChecklistItemResolutionApplication {
  readonly application: CrossRunAuditCatalogChecklistItemBlockerApplication;
  readonly resolution: CrossRunAuditCatalogChecklistItemResolutionView;
}

export function createCrossRunAuditCatalogChecklistItemResolution(
  input: CreateCrossRunAuditCatalogChecklistItemResolutionInput,
): CrossRunAuditCatalogChecklistItemResolution {
  const catalogEntryId = input.catalogEntryId.trim();
  const operatorId = input.operatorId.trim();
  const scopeId = input.scopeId.trim();
  const items = normalizeChecklistItemResolutionItems(input.items);
  const resolutionNote = normalizeResolutionNote(input.resolutionNote);

  if (catalogEntryId.length === 0) {
    throw new Error(
      "Catalog checklist item resolutions require a catalog entry id.",
    );
  }

  if (operatorId.length === 0) {
    throw new Error(
      "Catalog checklist item resolutions require an operator id.",
    );
  }

  if (scopeId.length === 0) {
    throw new Error("Catalog checklist item resolutions require a scope id.");
  }

  if (items.length === 0) {
    throw new Error(
      "Catalog checklist item resolutions require at least one checklist item resolution entry.",
    );
  }

  return {
    ...(resolutionNote ? { resolutionNote } : {}),
    catalogEntryId,
    createdAt: input.timestamp,
    items,
    kind: "catalog-checklist-item-resolution",
    operatorId,
    scopeId,
    updatedAt: input.timestamp,
  };
}

export function compareCrossRunAuditCatalogChecklistItemResolution(
  left: CrossRunAuditCatalogChecklistItemResolution,
  right: CrossRunAuditCatalogChecklistItemResolution,
): number {
  return (
    compareResolutionPriority(left, right) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.catalogEntryId.localeCompare(right.catalogEntryId)
  );
}

export function normalizeChecklistItemResolutionItems(
  items: readonly CrossRunAuditCatalogChecklistItemResolutionItem[] | undefined,
  allowedItems?: readonly string[],
): readonly CrossRunAuditCatalogChecklistItemResolutionItem[] {
  const allowedItemSet = allowedItems
    ? new Set(allowedItems.map((item) => item.trim()).filter(Boolean))
    : undefined;
  const dedupedItems = new Map<
    string,
    CrossRunAuditCatalogChecklistItemResolutionState
  >();

  for (const entry of items ?? []) {
    const item = entry.item.trim();

    if (item.length === 0) {
      continue;
    }

    if (entry.state !== "resolved" && entry.state !== "unresolved") {
      throw new Error(
        `Catalog checklist item resolutions require state resolved|unresolved for "${item}".`,
      );
    }

    if (allowedItemSet && !allowedItemSet.has(item)) {
      throw new Error(
        `Catalog checklist item resolution "${item}" is not defined on the shared checklist item blocker layer.`,
      );
    }

    dedupedItems.set(item, entry.state);
  }

  return [...dedupedItems.entries()].map(([item, state]) => ({
    item,
    state,
  }));
}

function compareResolutionPriority(
  left: CrossRunAuditCatalogChecklistItemResolution,
  right: CrossRunAuditCatalogChecklistItemResolution,
): number {
  const leftPriority = left.items.some((item) => item.state === "resolved")
    ? 0
    : 1;
  const rightPriority = right.items.some((item) => item.state === "resolved")
    ? 0
    : 1;

  return leftPriority - rightPriority;
}

function normalizeResolutionNote(
  value: string | undefined,
): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}
