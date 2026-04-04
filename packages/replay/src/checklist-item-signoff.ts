import type {
  CrossRunAuditCatalogChecklistItemAcknowledgmentApplication,
  CrossRunAuditCatalogChecklistItemAcknowledgmentView,
} from "./checklist-item-acknowledgment";

export type CrossRunAuditCatalogChecklistItemSignoffState =
  | "signed-off"
  | "unsigned";

export interface CrossRunAuditCatalogChecklistItemSignoffItem {
  readonly item: string;
  readonly state: CrossRunAuditCatalogChecklistItemSignoffState;
}

export interface CrossRunAuditCatalogChecklistItemSignoff {
  readonly signoffNote?: string;
  readonly catalogEntryId: string;
  readonly createdAt: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemSignoffItem[];
  readonly kind: "catalog-checklist-item-signoff";
  readonly operatorId: string;
  readonly scopeId: string;
  readonly updatedAt: string;
}

export interface CreateCrossRunAuditCatalogChecklistItemSignoffInput {
  readonly signoffNote?: string;
  readonly catalogEntryId: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemSignoffItem[];
  readonly operatorId: string;
  readonly scopeId: string;
  readonly timestamp: string;
}

export interface UpdateCrossRunAuditCatalogChecklistItemSignoffInput {
  readonly signoffNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemSignoffItem[];
}

export interface CrossRunAuditCatalogChecklistItemSignoffStore {
  deleteCatalogChecklistItemSignoff(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemSignoff | undefined>;
  getCatalogChecklistItemSignoff(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemSignoff | undefined>;
  listCatalogChecklistItemSignoffs(): Promise<
    readonly CrossRunAuditCatalogChecklistItemSignoff[]
  >;
  saveCatalogChecklistItemSignoff(
    signoff: CrossRunAuditCatalogChecklistItemSignoff,
  ): Promise<CrossRunAuditCatalogChecklistItemSignoff>;
}

export interface CrossRunAuditCatalogChecklistItemSignoffView {
  readonly signoff: CrossRunAuditCatalogChecklistItemSignoff;
  readonly acknowledgment: CrossRunAuditCatalogChecklistItemAcknowledgmentView;
}

export interface CrossRunAuditCatalogChecklistItemSignoffCollection {
  readonly items: readonly CrossRunAuditCatalogChecklistItemSignoffView[];
  readonly totalCount: number;
}

export interface CrossRunAuditCatalogChecklistItemSignoffApplication {
  readonly application: CrossRunAuditCatalogChecklistItemAcknowledgmentApplication;
  readonly signoff: CrossRunAuditCatalogChecklistItemSignoffView;
}

export function createCrossRunAuditCatalogChecklistItemSignoff(
  input: CreateCrossRunAuditCatalogChecklistItemSignoffInput,
): CrossRunAuditCatalogChecklistItemSignoff {
  const catalogEntryId = input.catalogEntryId.trim();
  const operatorId = input.operatorId.trim();
  const scopeId = input.scopeId.trim();
  const items = normalizeChecklistItemSignoffItems(input.items);
  const signoffNote = normalizeSignoffNote(input.signoffNote);

  if (catalogEntryId.length === 0) {
    throw new Error(
      "Catalog checklist item signoffs require a catalog entry id.",
    );
  }

  if (operatorId.length === 0) {
    throw new Error("Catalog checklist item signoffs require an operator id.");
  }

  if (scopeId.length === 0) {
    throw new Error("Catalog checklist item signoffs require a scope id.");
  }

  if (items.length === 0) {
    throw new Error(
      "Catalog checklist item signoffs require at least one checklist item signoff entry.",
    );
  }

  return {
    ...(signoffNote ? { signoffNote } : {}),
    catalogEntryId,
    createdAt: input.timestamp,
    items,
    kind: "catalog-checklist-item-signoff",
    operatorId,
    scopeId,
    updatedAt: input.timestamp,
  };
}

export function compareCrossRunAuditCatalogChecklistItemSignoff(
  left: CrossRunAuditCatalogChecklistItemSignoff,
  right: CrossRunAuditCatalogChecklistItemSignoff,
): number {
  return (
    compareSignoffPriority(left, right) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.catalogEntryId.localeCompare(right.catalogEntryId)
  );
}

export function normalizeChecklistItemSignoffItems(
  items: readonly CrossRunAuditCatalogChecklistItemSignoffItem[] | undefined,
  allowedItems?: readonly string[],
): readonly CrossRunAuditCatalogChecklistItemSignoffItem[] {
  const allowedItemSet = allowedItems
    ? new Set(allowedItems.map((item) => item.trim()).filter(Boolean))
    : undefined;
  const dedupedItems = new Map<
    string,
    CrossRunAuditCatalogChecklistItemSignoffState
  >();

  for (const entry of items ?? []) {
    const item = entry.item.trim();

    if (item.length === 0) {
      continue;
    }

    if (entry.state !== "signed-off" && entry.state !== "unsigned") {
      throw new Error(
        `Catalog checklist item signoffs require state signed-off|unsigned for "${item}".`,
      );
    }

    if (allowedItemSet && !allowedItemSet.has(item)) {
      throw new Error(
        `Catalog checklist item signoff "${item}" is not defined on the shared checklist item acknowledgment layer.`,
      );
    }

    dedupedItems.set(item, entry.state);
  }

  return [...dedupedItems.entries()].map(([item, state]) => ({
    item,
    state,
  }));
}

function compareSignoffPriority(
  left: CrossRunAuditCatalogChecklistItemSignoff,
  right: CrossRunAuditCatalogChecklistItemSignoff,
): number {
  const leftPriority = left.items.some((item) => item.state === "signed-off")
    ? 0
    : 1;
  const rightPriority = right.items.some((item) => item.state === "signed-off")
    ? 0
    : 1;

  return leftPriority - rightPriority;
}

function normalizeSignoffNote(value: string | undefined): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}
