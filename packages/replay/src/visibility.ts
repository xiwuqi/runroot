import type {
  CrossRunAuditCatalogEntryApplication,
  CrossRunAuditCatalogEntryView,
} from "./catalog";

export type CrossRunAuditCatalogVisibilityState = "personal" | "shared";

export interface CrossRunAuditCatalogVisibilityViewer {
  readonly operatorId: string;
  readonly scopeId: string;
}

export interface CrossRunAuditCatalogVisibility {
  readonly catalogEntryId: string;
  readonly createdAt: string;
  readonly kind: "catalog-visibility";
  readonly ownerId: string;
  readonly scopeId: string;
  readonly state: CrossRunAuditCatalogVisibilityState;
  readonly updatedAt: string;
}

export interface CreateCrossRunAuditCatalogVisibilityInput {
  readonly catalogEntryId: string;
  readonly ownerId: string;
  readonly scopeId: string;
  readonly state: CrossRunAuditCatalogVisibilityState;
  readonly timestamp: string;
}

export interface CrossRunAuditCatalogVisibilityStore {
  getCatalogVisibility(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogVisibility | undefined>;
  listCatalogVisibility(): Promise<readonly CrossRunAuditCatalogVisibility[]>;
  saveCatalogVisibility(
    visibility: CrossRunAuditCatalogVisibility,
  ): Promise<CrossRunAuditCatalogVisibility>;
}

export interface CrossRunAuditCatalogVisibilityView {
  readonly catalogEntry: CrossRunAuditCatalogEntryView;
  readonly visibility: CrossRunAuditCatalogVisibility;
}

export interface CrossRunAuditCatalogVisibilityCollection {
  readonly items: readonly CrossRunAuditCatalogVisibilityView[];
  readonly totalCount: number;
}

export interface CrossRunAuditCatalogVisibilityApplication {
  readonly application: CrossRunAuditCatalogEntryApplication;
  readonly visibility: CrossRunAuditCatalogVisibilityView;
}

export function createCrossRunAuditCatalogVisibility(
  input: CreateCrossRunAuditCatalogVisibilityInput,
): CrossRunAuditCatalogVisibility {
  const catalogEntryId = input.catalogEntryId.trim();
  const ownerId = input.ownerId.trim();
  const scopeId = input.scopeId.trim();

  if (catalogEntryId.length === 0) {
    throw new Error("Catalog visibility requires a catalog entry id.");
  }

  if (ownerId.length === 0) {
    throw new Error("Catalog visibility requires an owner id.");
  }

  if (scopeId.length === 0) {
    throw new Error("Catalog visibility requires a scope id.");
  }

  return {
    catalogEntryId,
    createdAt: input.timestamp,
    kind: "catalog-visibility",
    ownerId,
    scopeId,
    state: input.state,
    updatedAt: input.timestamp,
  };
}

export function compareCrossRunAuditCatalogVisibility(
  left: CrossRunAuditCatalogVisibility,
  right: CrossRunAuditCatalogVisibility,
): number {
  return (
    compareVisibilityState(left, right) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.catalogEntryId.localeCompare(right.catalogEntryId)
  );
}

export function isCrossRunAuditCatalogVisibleToViewer(
  visibility: CrossRunAuditCatalogVisibility,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): boolean {
  return (
    visibility.ownerId === viewer.operatorId ||
    (visibility.state === "shared" && visibility.scopeId === viewer.scopeId)
  );
}

function compareVisibilityState(
  left: CrossRunAuditCatalogVisibility,
  right: CrossRunAuditCatalogVisibility,
): number {
  const leftShared = left.state === "shared" ? 0 : 1;
  const rightShared = right.state === "shared" ? 0 : 1;

  return leftShared - rightShared;
}
