import type {
  CrossRunAuditCatalogChecklistItemSignoffApplication,
  CrossRunAuditCatalogChecklistItemSignoffView,
} from "./checklist-item-signoff";

export type CrossRunAuditCatalogChecklistItemExceptionState =
  | "excepted"
  | "not-excepted";

export interface CrossRunAuditCatalogChecklistItemExceptionItem {
  readonly item: string;
  readonly state: CrossRunAuditCatalogChecklistItemExceptionState;
}

export interface CrossRunAuditCatalogChecklistItemException {
  readonly exceptionNote?: string;
  readonly catalogEntryId: string;
  readonly createdAt: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemExceptionItem[];
  readonly kind: "catalog-checklist-item-exception";
  readonly operatorId: string;
  readonly scopeId: string;
  readonly updatedAt: string;
}

export interface CreateCrossRunAuditCatalogChecklistItemExceptionInput {
  readonly exceptionNote?: string;
  readonly catalogEntryId: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemExceptionItem[];
  readonly operatorId: string;
  readonly scopeId: string;
  readonly timestamp: string;
}

export interface UpdateCrossRunAuditCatalogChecklistItemExceptionInput {
  readonly exceptionNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemExceptionItem[];
}

export interface CrossRunAuditCatalogChecklistItemExceptionStore {
  deleteCatalogChecklistItemException(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemException | undefined>;
  getCatalogChecklistItemException(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemException | undefined>;
  listCatalogChecklistItemExceptions(): Promise<
    readonly CrossRunAuditCatalogChecklistItemException[]
  >;
  saveCatalogChecklistItemException(
    exception: CrossRunAuditCatalogChecklistItemException,
  ): Promise<CrossRunAuditCatalogChecklistItemException>;
}

export interface CrossRunAuditCatalogChecklistItemExceptionView {
  readonly exception: CrossRunAuditCatalogChecklistItemException;
  readonly signoff: CrossRunAuditCatalogChecklistItemSignoffView;
}

export interface CrossRunAuditCatalogChecklistItemExceptionCollection {
  readonly items: readonly CrossRunAuditCatalogChecklistItemExceptionView[];
  readonly totalCount: number;
}

export interface CrossRunAuditCatalogChecklistItemExceptionApplication {
  readonly application: CrossRunAuditCatalogChecklistItemSignoffApplication;
  readonly exception: CrossRunAuditCatalogChecklistItemExceptionView;
}

export function createCrossRunAuditCatalogChecklistItemException(
  input: CreateCrossRunAuditCatalogChecklistItemExceptionInput,
): CrossRunAuditCatalogChecklistItemException {
  const catalogEntryId = input.catalogEntryId.trim();
  const operatorId = input.operatorId.trim();
  const scopeId = input.scopeId.trim();
  const items = normalizeChecklistItemExceptionItems(input.items);
  const exceptionNote = normalizeExceptionNote(input.exceptionNote);

  if (catalogEntryId.length === 0) {
    throw new Error(
      "Catalog checklist item exceptions require a catalog entry id.",
    );
  }

  if (operatorId.length === 0) {
    throw new Error(
      "Catalog checklist item exceptions require an operator id.",
    );
  }

  if (scopeId.length === 0) {
    throw new Error("Catalog checklist item exceptions require a scope id.");
  }

  if (items.length === 0) {
    throw new Error(
      "Catalog checklist item exceptions require at least one checklist item exception entry.",
    );
  }

  return {
    ...(exceptionNote ? { exceptionNote } : {}),
    catalogEntryId,
    createdAt: input.timestamp,
    items,
    kind: "catalog-checklist-item-exception",
    operatorId,
    scopeId,
    updatedAt: input.timestamp,
  };
}

export function compareCrossRunAuditCatalogChecklistItemException(
  left: CrossRunAuditCatalogChecklistItemException,
  right: CrossRunAuditCatalogChecklistItemException,
): number {
  return (
    compareExceptionPriority(left, right) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.catalogEntryId.localeCompare(right.catalogEntryId)
  );
}

export function normalizeChecklistItemExceptionItems(
  items: readonly CrossRunAuditCatalogChecklistItemExceptionItem[] | undefined,
  allowedItems?: readonly string[],
): readonly CrossRunAuditCatalogChecklistItemExceptionItem[] {
  const allowedItemSet = allowedItems
    ? new Set(allowedItems.map((item) => item.trim()).filter(Boolean))
    : undefined;
  const dedupedItems = new Map<
    string,
    CrossRunAuditCatalogChecklistItemExceptionState
  >();

  for (const entry of items ?? []) {
    const item = entry.item.trim();

    if (item.length === 0) {
      continue;
    }

    if (entry.state !== "excepted" && entry.state !== "not-excepted") {
      throw new Error(
        `Catalog checklist item exceptions require state excepted|not-excepted for "${item}".`,
      );
    }

    if (allowedItemSet && !allowedItemSet.has(item)) {
      throw new Error(
        `Catalog checklist item exception "${item}" is not defined on the shared checklist item sign-off layer.`,
      );
    }

    dedupedItems.set(item, entry.state);
  }

  return [...dedupedItems.entries()].map(([item, state]) => ({
    item,
    state,
  }));
}

function compareExceptionPriority(
  left: CrossRunAuditCatalogChecklistItemException,
  right: CrossRunAuditCatalogChecklistItemException,
): number {
  const leftPriority = left.items.some((item) => item.state === "excepted")
    ? 0
    : 1;
  const rightPriority = right.items.some((item) => item.state === "excepted")
    ? 0
    : 1;

  return leftPriority - rightPriority;
}

function normalizeExceptionNote(value: string | undefined): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}
