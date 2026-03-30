import type {
  CrossRunAuditCatalogVisibilityApplication,
  CrossRunAuditCatalogVisibilityView,
} from "./visibility";

export type CrossRunAuditCatalogReviewState = "recommended" | "reviewed";

export interface CrossRunAuditCatalogReviewSignal {
  readonly catalogEntryId: string;
  readonly createdAt: string;
  readonly kind: "catalog-review-signal";
  readonly note?: string;
  readonly operatorId: string;
  readonly scopeId: string;
  readonly state: CrossRunAuditCatalogReviewState;
  readonly updatedAt: string;
}

export interface CreateCrossRunAuditCatalogReviewSignalInput {
  readonly catalogEntryId: string;
  readonly note?: string;
  readonly operatorId: string;
  readonly scopeId: string;
  readonly state: CrossRunAuditCatalogReviewState;
  readonly timestamp: string;
}

export interface UpdateCrossRunAuditCatalogReviewSignalInput {
  readonly note?: string;
  readonly state: CrossRunAuditCatalogReviewState;
}

export interface CrossRunAuditCatalogReviewSignalStore {
  deleteCatalogReviewSignal(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogReviewSignal | undefined>;
  getCatalogReviewSignal(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogReviewSignal | undefined>;
  listCatalogReviewSignals(): Promise<
    readonly CrossRunAuditCatalogReviewSignal[]
  >;
  saveCatalogReviewSignal(
    reviewSignal: CrossRunAuditCatalogReviewSignal,
  ): Promise<CrossRunAuditCatalogReviewSignal>;
}

export interface CrossRunAuditCatalogReviewSignalView {
  readonly review: CrossRunAuditCatalogReviewSignal;
  readonly visibility: CrossRunAuditCatalogVisibilityView;
}

export interface CrossRunAuditCatalogReviewSignalCollection {
  readonly items: readonly CrossRunAuditCatalogReviewSignalView[];
  readonly totalCount: number;
}

export interface CrossRunAuditCatalogReviewSignalApplication {
  readonly application: CrossRunAuditCatalogVisibilityApplication;
  readonly review: CrossRunAuditCatalogReviewSignalView;
}

export function createCrossRunAuditCatalogReviewSignal(
  input: CreateCrossRunAuditCatalogReviewSignalInput,
): CrossRunAuditCatalogReviewSignal {
  const catalogEntryId = input.catalogEntryId.trim();
  const operatorId = input.operatorId.trim();
  const scopeId = input.scopeId.trim();
  const note = input.note?.trim();

  if (catalogEntryId.length === 0) {
    throw new Error("Catalog review signals require a catalog entry id.");
  }

  if (operatorId.length === 0) {
    throw new Error("Catalog review signals require an operator id.");
  }

  if (scopeId.length === 0) {
    throw new Error("Catalog review signals require a scope id.");
  }

  return {
    catalogEntryId,
    createdAt: input.timestamp,
    kind: "catalog-review-signal",
    ...(note ? { note } : {}),
    operatorId,
    scopeId,
    state: input.state,
    updatedAt: input.timestamp,
  };
}

export function compareCrossRunAuditCatalogReviewSignals(
  left: CrossRunAuditCatalogReviewSignal,
  right: CrossRunAuditCatalogReviewSignal,
): number {
  return (
    compareReviewState(left, right) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.catalogEntryId.localeCompare(right.catalogEntryId)
  );
}

function compareReviewState(
  left: CrossRunAuditCatalogReviewSignal,
  right: CrossRunAuditCatalogReviewSignal,
): number {
  const leftPriority = left.state === "recommended" ? 0 : 1;
  const rightPriority = right.state === "recommended" ? 0 : 1;

  return leftPriority - rightPriority;
}
