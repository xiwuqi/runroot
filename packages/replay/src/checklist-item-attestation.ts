import type {
  CrossRunAuditCatalogChecklistItemEvidenceApplication,
  CrossRunAuditCatalogChecklistItemEvidenceView,
} from "./checklist-item-evidence";

export type CrossRunAuditCatalogChecklistItemAttestationState =
  | "attested"
  | "unattested";

export interface CrossRunAuditCatalogChecklistItemAttestationItem {
  readonly item: string;
  readonly state: CrossRunAuditCatalogChecklistItemAttestationState;
}

export interface CrossRunAuditCatalogChecklistItemAttestation {
  readonly attestationNote?: string;
  readonly catalogEntryId: string;
  readonly createdAt: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemAttestationItem[];
  readonly kind: "catalog-checklist-item-attestation";
  readonly operatorId: string;
  readonly scopeId: string;
  readonly updatedAt: string;
}

export interface CreateCrossRunAuditCatalogChecklistItemAttestationInput {
  readonly attestationNote?: string;
  readonly catalogEntryId: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemAttestationItem[];
  readonly operatorId: string;
  readonly scopeId: string;
  readonly timestamp: string;
}

export interface UpdateCrossRunAuditCatalogChecklistItemAttestationInput {
  readonly attestationNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemAttestationItem[];
}

export interface CrossRunAuditCatalogChecklistItemAttestationStore {
  deleteCatalogChecklistItemAttestation(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemAttestation | undefined>;
  getCatalogChecklistItemAttestation(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemAttestation | undefined>;
  listCatalogChecklistItemAttestations(): Promise<
    readonly CrossRunAuditCatalogChecklistItemAttestation[]
  >;
  saveCatalogChecklistItemAttestation(
    attestation: CrossRunAuditCatalogChecklistItemAttestation,
  ): Promise<CrossRunAuditCatalogChecklistItemAttestation>;
}

export interface CrossRunAuditCatalogChecklistItemAttestationView {
  readonly attestation: CrossRunAuditCatalogChecklistItemAttestation;
  readonly evidence: CrossRunAuditCatalogChecklistItemEvidenceView;
}

export interface CrossRunAuditCatalogChecklistItemAttestationCollection {
  readonly items: readonly CrossRunAuditCatalogChecklistItemAttestationView[];
  readonly totalCount: number;
}

export interface CrossRunAuditCatalogChecklistItemAttestationApplication {
  readonly application: CrossRunAuditCatalogChecklistItemEvidenceApplication;
  readonly attestation: CrossRunAuditCatalogChecklistItemAttestationView;
}

export function createCrossRunAuditCatalogChecklistItemAttestation(
  input: CreateCrossRunAuditCatalogChecklistItemAttestationInput,
): CrossRunAuditCatalogChecklistItemAttestation {
  const catalogEntryId = input.catalogEntryId.trim();
  const operatorId = input.operatorId.trim();
  const scopeId = input.scopeId.trim();
  const items = normalizeChecklistItemAttestationItems(input.items);
  const attestationNote = normalizeAttestationNote(input.attestationNote);

  if (catalogEntryId.length === 0) {
    throw new Error(
      "Catalog checklist item attestations require a catalog entry id.",
    );
  }

  if (operatorId.length === 0) {
    throw new Error(
      "Catalog checklist item attestations require an operator id.",
    );
  }

  if (scopeId.length === 0) {
    throw new Error("Catalog checklist item attestations require a scope id.");
  }

  if (items.length === 0) {
    throw new Error(
      "Catalog checklist item attestations require at least one checklist item attestation entry.",
    );
  }

  return {
    ...(attestationNote ? { attestationNote } : {}),
    catalogEntryId,
    createdAt: input.timestamp,
    items,
    kind: "catalog-checklist-item-attestation",
    operatorId,
    scopeId,
    updatedAt: input.timestamp,
  };
}

export function compareCrossRunAuditCatalogChecklistItemAttestation(
  left: CrossRunAuditCatalogChecklistItemAttestation,
  right: CrossRunAuditCatalogChecklistItemAttestation,
): number {
  return (
    compareAttestationPriority(left, right) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.catalogEntryId.localeCompare(right.catalogEntryId)
  );
}

export function normalizeChecklistItemAttestationItems(
  items:
    | readonly CrossRunAuditCatalogChecklistItemAttestationItem[]
    | undefined,
  allowedItems?: readonly string[],
): readonly CrossRunAuditCatalogChecklistItemAttestationItem[] {
  const allowedItemSet = allowedItems
    ? new Set(allowedItems.map((item) => item.trim()).filter(Boolean))
    : undefined;
  const dedupedItems = new Map<
    string,
    CrossRunAuditCatalogChecklistItemAttestationState
  >();

  for (const entry of items ?? []) {
    const item = entry.item.trim();

    if (item.length === 0) {
      continue;
    }

    if (entry.state !== "attested" && entry.state !== "unattested") {
      throw new Error(
        `Catalog checklist item attestations require state attested|unattested for "${item}".`,
      );
    }

    if (allowedItemSet && !allowedItemSet.has(item)) {
      throw new Error(
        `Catalog checklist item attestation "${item}" is not defined on the shared checklist item evidence layer.`,
      );
    }

    dedupedItems.set(item, entry.state);
  }

  return [...dedupedItems.entries()].map(([item, state]) => ({
    item,
    state,
  }));
}

function compareAttestationPriority(
  left: CrossRunAuditCatalogChecklistItemAttestation,
  right: CrossRunAuditCatalogChecklistItemAttestation,
): number {
  const leftPriority = left.items.some((item) => item.state === "attested")
    ? 0
    : 1;
  const rightPriority = right.items.some((item) => item.state === "attested")
    ? 0
    : 1;

  return leftPriority - rightPriority;
}

function normalizeAttestationNote(
  value: string | undefined,
): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}
