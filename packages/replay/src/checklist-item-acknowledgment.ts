import type {
  CrossRunAuditCatalogChecklistItemAttestationApplication,
  CrossRunAuditCatalogChecklistItemAttestationView,
} from "./checklist-item-attestation";

export type CrossRunAuditCatalogChecklistItemAcknowledgmentState =
  | "acknowledged"
  | "unacknowledged";

export interface CrossRunAuditCatalogChecklistItemAcknowledgmentItem {
  readonly item: string;
  readonly state: CrossRunAuditCatalogChecklistItemAcknowledgmentState;
}

export interface CrossRunAuditCatalogChecklistItemAcknowledgment {
  readonly acknowledgmentNote?: string;
  readonly catalogEntryId: string;
  readonly createdAt: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemAcknowledgmentItem[];
  readonly kind: "catalog-checklist-item-acknowledgment";
  readonly operatorId: string;
  readonly scopeId: string;
  readonly updatedAt: string;
}

export interface CreateCrossRunAuditCatalogChecklistItemAcknowledgmentInput {
  readonly acknowledgmentNote?: string;
  readonly catalogEntryId: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemAcknowledgmentItem[];
  readonly operatorId: string;
  readonly scopeId: string;
  readonly timestamp: string;
}

export interface UpdateCrossRunAuditCatalogChecklistItemAcknowledgmentInput {
  readonly acknowledgmentNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemAcknowledgmentItem[];
}

export interface CrossRunAuditCatalogChecklistItemAcknowledgmentStore {
  deleteCatalogChecklistItemAcknowledgment(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemAcknowledgment | undefined>;
  getCatalogChecklistItemAcknowledgment(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemAcknowledgment | undefined>;
  listCatalogChecklistItemAcknowledgments(): Promise<
    readonly CrossRunAuditCatalogChecklistItemAcknowledgment[]
  >;
  saveCatalogChecklistItemAcknowledgment(
    acknowledgment: CrossRunAuditCatalogChecklistItemAcknowledgment,
  ): Promise<CrossRunAuditCatalogChecklistItemAcknowledgment>;
}

export interface CrossRunAuditCatalogChecklistItemAcknowledgmentView {
  readonly acknowledgment: CrossRunAuditCatalogChecklistItemAcknowledgment;
  readonly attestation: CrossRunAuditCatalogChecklistItemAttestationView;
}

export interface CrossRunAuditCatalogChecklistItemAcknowledgmentCollection {
  readonly items: readonly CrossRunAuditCatalogChecklistItemAcknowledgmentView[];
  readonly totalCount: number;
}

export interface CrossRunAuditCatalogChecklistItemAcknowledgmentApplication {
  readonly application: CrossRunAuditCatalogChecklistItemAttestationApplication;
  readonly acknowledgment: CrossRunAuditCatalogChecklistItemAcknowledgmentView;
}

export function createCrossRunAuditCatalogChecklistItemAcknowledgment(
  input: CreateCrossRunAuditCatalogChecklistItemAcknowledgmentInput,
): CrossRunAuditCatalogChecklistItemAcknowledgment {
  const catalogEntryId = input.catalogEntryId.trim();
  const operatorId = input.operatorId.trim();
  const scopeId = input.scopeId.trim();
  const items = normalizeChecklistItemAcknowledgmentItems(input.items);
  const acknowledgmentNote = normalizeAcknowledgmentNote(
    input.acknowledgmentNote,
  );

  if (catalogEntryId.length === 0) {
    throw new Error(
      "Catalog checklist item acknowledgments require a catalog entry id.",
    );
  }

  if (operatorId.length === 0) {
    throw new Error(
      "Catalog checklist item acknowledgments require an operator id.",
    );
  }

  if (scopeId.length === 0) {
    throw new Error(
      "Catalog checklist item acknowledgments require a scope id.",
    );
  }

  if (items.length === 0) {
    throw new Error(
      "Catalog checklist item acknowledgments require at least one checklist item acknowledgment entry.",
    );
  }

  return {
    ...(acknowledgmentNote ? { acknowledgmentNote } : {}),
    catalogEntryId,
    createdAt: input.timestamp,
    items,
    kind: "catalog-checklist-item-acknowledgment",
    operatorId,
    scopeId,
    updatedAt: input.timestamp,
  };
}

export function compareCrossRunAuditCatalogChecklistItemAcknowledgment(
  left: CrossRunAuditCatalogChecklistItemAcknowledgment,
  right: CrossRunAuditCatalogChecklistItemAcknowledgment,
): number {
  return (
    compareAcknowledgmentPriority(left, right) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.catalogEntryId.localeCompare(right.catalogEntryId)
  );
}

export function normalizeChecklistItemAcknowledgmentItems(
  items:
    | readonly CrossRunAuditCatalogChecklistItemAcknowledgmentItem[]
    | undefined,
  allowedItems?: readonly string[],
): readonly CrossRunAuditCatalogChecklistItemAcknowledgmentItem[] {
  const allowedItemSet = allowedItems
    ? new Set(allowedItems.map((item) => item.trim()).filter(Boolean))
    : undefined;
  const dedupedItems = new Map<
    string,
    CrossRunAuditCatalogChecklistItemAcknowledgmentState
  >();

  for (const entry of items ?? []) {
    const item = entry.item.trim();

    if (item.length === 0) {
      continue;
    }

    if (entry.state !== "acknowledged" && entry.state !== "unacknowledged") {
      throw new Error(
        `Catalog checklist item acknowledgments require state acknowledged|unacknowledged for "${item}".`,
      );
    }

    if (allowedItemSet && !allowedItemSet.has(item)) {
      throw new Error(
        `Catalog checklist item acknowledgment "${item}" is not defined on the shared checklist item attestation layer.`,
      );
    }

    dedupedItems.set(item, entry.state);
  }

  return [...dedupedItems.entries()].map(([item, state]) => ({
    item,
    state,
  }));
}

function compareAcknowledgmentPriority(
  left: CrossRunAuditCatalogChecklistItemAcknowledgment,
  right: CrossRunAuditCatalogChecklistItemAcknowledgment,
): number {
  const leftPriority = left.items.some((item) => item.state === "acknowledged")
    ? 0
    : 1;
  const rightPriority = right.items.some(
    (item) => item.state === "acknowledged",
  )
    ? 0
    : 1;

  return leftPriority - rightPriority;
}

function normalizeAcknowledgmentNote(
  value: string | undefined,
): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}
