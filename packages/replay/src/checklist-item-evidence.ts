import type {
  CrossRunAuditCatalogChecklistItemVerificationApplication,
  CrossRunAuditCatalogChecklistItemVerificationView,
} from "./checklist-item-verification";

export interface CrossRunAuditCatalogChecklistItemEvidenceItem {
  readonly item: string;
  readonly references: readonly string[];
}

export interface CrossRunAuditCatalogChecklistItemEvidence {
  readonly catalogEntryId: string;
  readonly createdAt: string;
  readonly evidenceNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemEvidenceItem[];
  readonly kind: "catalog-checklist-item-evidence";
  readonly operatorId: string;
  readonly scopeId: string;
  readonly updatedAt: string;
}

export interface CreateCrossRunAuditCatalogChecklistItemEvidenceInput {
  readonly catalogEntryId: string;
  readonly evidenceNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemEvidenceItem[];
  readonly operatorId: string;
  readonly scopeId: string;
  readonly timestamp: string;
}

export interface UpdateCrossRunAuditCatalogChecklistItemEvidenceInput {
  readonly evidenceNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemEvidenceItem[];
}

export interface CrossRunAuditCatalogChecklistItemEvidenceStore {
  deleteCatalogChecklistItemEvidence(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemEvidence | undefined>;
  getCatalogChecklistItemEvidence(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemEvidence | undefined>;
  listCatalogChecklistItemEvidence(): Promise<
    readonly CrossRunAuditCatalogChecklistItemEvidence[]
  >;
  saveCatalogChecklistItemEvidence(
    evidence: CrossRunAuditCatalogChecklistItemEvidence,
  ): Promise<CrossRunAuditCatalogChecklistItemEvidence>;
}

export interface CrossRunAuditCatalogChecklistItemEvidenceView {
  readonly evidence: CrossRunAuditCatalogChecklistItemEvidence;
  readonly verification: CrossRunAuditCatalogChecklistItemVerificationView;
}

export interface CrossRunAuditCatalogChecklistItemEvidenceCollection {
  readonly items: readonly CrossRunAuditCatalogChecklistItemEvidenceView[];
  readonly totalCount: number;
}

export interface CrossRunAuditCatalogChecklistItemEvidenceApplication {
  readonly application: CrossRunAuditCatalogChecklistItemVerificationApplication;
  readonly evidence: CrossRunAuditCatalogChecklistItemEvidenceView;
}

export function createCrossRunAuditCatalogChecklistItemEvidence(
  input: CreateCrossRunAuditCatalogChecklistItemEvidenceInput,
): CrossRunAuditCatalogChecklistItemEvidence {
  const catalogEntryId = input.catalogEntryId.trim();
  const operatorId = input.operatorId.trim();
  const scopeId = input.scopeId.trim();
  const items = normalizeChecklistItemEvidenceItems(input.items);
  const evidenceNote = normalizeEvidenceNote(input.evidenceNote);

  if (catalogEntryId.length === 0) {
    throw new Error(
      "Catalog checklist item evidence requires a catalog entry id.",
    );
  }

  if (operatorId.length === 0) {
    throw new Error("Catalog checklist item evidence requires an operator id.");
  }

  if (scopeId.length === 0) {
    throw new Error("Catalog checklist item evidence requires a scope id.");
  }

  if (items.length === 0) {
    throw new Error(
      "Catalog checklist item evidence requires at least one checklist item evidence entry.",
    );
  }

  return {
    ...(evidenceNote ? { evidenceNote } : {}),
    catalogEntryId,
    createdAt: input.timestamp,
    items,
    kind: "catalog-checklist-item-evidence",
    operatorId,
    scopeId,
    updatedAt: input.timestamp,
  };
}

export function compareCrossRunAuditCatalogChecklistItemEvidence(
  left: CrossRunAuditCatalogChecklistItemEvidence,
  right: CrossRunAuditCatalogChecklistItemEvidence,
): number {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.catalogEntryId.localeCompare(right.catalogEntryId)
  );
}

export function normalizeChecklistItemEvidenceItems(
  items: readonly CrossRunAuditCatalogChecklistItemEvidenceItem[] | undefined,
  allowedItems?: readonly string[],
): readonly CrossRunAuditCatalogChecklistItemEvidenceItem[] {
  const allowedItemSet = allowedItems
    ? new Set(allowedItems.map((item) => item.trim()).filter(Boolean))
    : undefined;
  const dedupedItems = new Map<string, readonly string[]>();

  for (const entry of items ?? []) {
    const item = entry.item.trim();

    if (item.length === 0) {
      continue;
    }

    if (allowedItemSet && !allowedItemSet.has(item)) {
      throw new Error(
        `Catalog checklist item evidence "${item}" is not defined on the shared checklist item verification layer.`,
      );
    }

    const references = normalizeEvidenceReferences(entry.references);

    if (references.length === 0) {
      continue;
    }

    dedupedItems.set(item, references);
  }

  return [...dedupedItems.entries()].map(([item, references]) => ({
    item,
    references,
  }));
}

function normalizeEvidenceReferences(
  references: readonly string[] | undefined,
): readonly string[] {
  return [
    ...new Set((references ?? []).map((value) => value.trim()).filter(Boolean)),
  ];
}

function normalizeEvidenceNote(value: string | undefined): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}
