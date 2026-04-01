import type {
  CrossRunAuditCatalogChecklistItemResolutionApplication,
  CrossRunAuditCatalogChecklistItemResolutionView,
} from "./checklist-item-resolution";

export type CrossRunAuditCatalogChecklistItemVerificationState =
  | "verified"
  | "unverified";

export interface CrossRunAuditCatalogChecklistItemVerificationItem {
  readonly item: string;
  readonly state: CrossRunAuditCatalogChecklistItemVerificationState;
}

export interface CrossRunAuditCatalogChecklistItemVerification {
  readonly verificationNote?: string;
  readonly catalogEntryId: string;
  readonly createdAt: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemVerificationItem[];
  readonly kind: "catalog-checklist-item-verification";
  readonly operatorId: string;
  readonly scopeId: string;
  readonly updatedAt: string;
}

export interface CreateCrossRunAuditCatalogChecklistItemVerificationInput {
  readonly verificationNote?: string;
  readonly catalogEntryId: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemVerificationItem[];
  readonly operatorId: string;
  readonly scopeId: string;
  readonly timestamp: string;
}

export interface UpdateCrossRunAuditCatalogChecklistItemVerificationInput {
  readonly verificationNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemVerificationItem[];
}

export interface CrossRunAuditCatalogChecklistItemVerificationStore {
  deleteCatalogChecklistItemVerification(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemVerification | undefined>;
  getCatalogChecklistItemVerification(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogChecklistItemVerification | undefined>;
  listCatalogChecklistItemVerifications(): Promise<
    readonly CrossRunAuditCatalogChecklistItemVerification[]
  >;
  saveCatalogChecklistItemVerification(
    verification: CrossRunAuditCatalogChecklistItemVerification,
  ): Promise<CrossRunAuditCatalogChecklistItemVerification>;
}

export interface CrossRunAuditCatalogChecklistItemVerificationView {
  readonly resolution: CrossRunAuditCatalogChecklistItemResolutionView;
  readonly verification: CrossRunAuditCatalogChecklistItemVerification;
}

export interface CrossRunAuditCatalogChecklistItemVerificationCollection {
  readonly items: readonly CrossRunAuditCatalogChecklistItemVerificationView[];
  readonly totalCount: number;
}

export interface CrossRunAuditCatalogChecklistItemVerificationApplication {
  readonly application: CrossRunAuditCatalogChecklistItemResolutionApplication;
  readonly verification: CrossRunAuditCatalogChecklistItemVerificationView;
}

export function createCrossRunAuditCatalogChecklistItemVerification(
  input: CreateCrossRunAuditCatalogChecklistItemVerificationInput,
): CrossRunAuditCatalogChecklistItemVerification {
  const catalogEntryId = input.catalogEntryId.trim();
  const operatorId = input.operatorId.trim();
  const scopeId = input.scopeId.trim();
  const items = normalizeChecklistItemVerificationItems(input.items);
  const verificationNote = normalizeVerificationNote(input.verificationNote);

  if (catalogEntryId.length === 0) {
    throw new Error(
      "Catalog checklist item verifications require a catalog entry id.",
    );
  }

  if (operatorId.length === 0) {
    throw new Error(
      "Catalog checklist item verifications require an operator id.",
    );
  }

  if (scopeId.length === 0) {
    throw new Error("Catalog checklist item verifications require a scope id.");
  }

  if (items.length === 0) {
    throw new Error(
      "Catalog checklist item verifications require at least one checklist item verification entry.",
    );
  }

  return {
    ...(verificationNote ? { verificationNote } : {}),
    catalogEntryId,
    createdAt: input.timestamp,
    items,
    kind: "catalog-checklist-item-verification",
    operatorId,
    scopeId,
    updatedAt: input.timestamp,
  };
}

export function compareCrossRunAuditCatalogChecklistItemVerification(
  left: CrossRunAuditCatalogChecklistItemVerification,
  right: CrossRunAuditCatalogChecklistItemVerification,
): number {
  return (
    compareVerificationPriority(left, right) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.catalogEntryId.localeCompare(right.catalogEntryId)
  );
}

export function normalizeChecklistItemVerificationItems(
  items:
    | readonly CrossRunAuditCatalogChecklistItemVerificationItem[]
    | undefined,
  allowedItems?: readonly string[],
): readonly CrossRunAuditCatalogChecklistItemVerificationItem[] {
  const allowedItemSet = allowedItems
    ? new Set(allowedItems.map((item) => item.trim()).filter(Boolean))
    : undefined;
  const dedupedItems = new Map<
    string,
    CrossRunAuditCatalogChecklistItemVerificationState
  >();

  for (const entry of items ?? []) {
    const item = entry.item.trim();

    if (item.length === 0) {
      continue;
    }

    if (entry.state !== "verified" && entry.state !== "unverified") {
      throw new Error(
        `Catalog checklist item verifications require state verified|unverified for "${item}".`,
      );
    }

    if (allowedItemSet && !allowedItemSet.has(item)) {
      throw new Error(
        `Catalog checklist item verification "${item}" is not defined on the shared checklist item resolution layer.`,
      );
    }

    dedupedItems.set(item, entry.state);
  }

  return [...dedupedItems.entries()].map(([item, state]) => ({
    item,
    state,
  }));
}

function compareVerificationPriority(
  left: CrossRunAuditCatalogChecklistItemVerification,
  right: CrossRunAuditCatalogChecklistItemVerification,
): number {
  const leftPriority = left.items.some((item) => item.state === "verified")
    ? 0
    : 1;
  const rightPriority = right.items.some((item) => item.state === "verified")
    ? 0
    : 1;

  return leftPriority - rightPriority;
}

function normalizeVerificationNote(
  value: string | undefined,
): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}
