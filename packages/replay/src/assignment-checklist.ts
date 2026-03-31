import type {
  CrossRunAuditCatalogReviewAssignmentApplication,
  CrossRunAuditCatalogReviewAssignmentView,
} from "./review-assignment";

export type CrossRunAuditCatalogAssignmentChecklistState =
  | "completed"
  | "pending";

export interface CrossRunAuditCatalogAssignmentChecklist {
  readonly catalogEntryId: string;
  readonly createdAt: string;
  readonly items?: readonly string[];
  readonly kind: "catalog-assignment-checklist";
  readonly operatorId: string;
  readonly scopeId: string;
  readonly state: CrossRunAuditCatalogAssignmentChecklistState;
  readonly updatedAt: string;
}

export interface CreateCrossRunAuditCatalogAssignmentChecklistInput {
  readonly catalogEntryId: string;
  readonly items?: readonly string[];
  readonly operatorId: string;
  readonly scopeId: string;
  readonly state: CrossRunAuditCatalogAssignmentChecklistState;
  readonly timestamp: string;
}

export interface UpdateCrossRunAuditCatalogAssignmentChecklistInput {
  readonly items?: readonly string[];
  readonly state: CrossRunAuditCatalogAssignmentChecklistState;
}

export interface CrossRunAuditCatalogAssignmentChecklistStore {
  deleteCatalogAssignmentChecklist(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogAssignmentChecklist | undefined>;
  getCatalogAssignmentChecklist(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogAssignmentChecklist | undefined>;
  listCatalogAssignmentChecklists(): Promise<
    readonly CrossRunAuditCatalogAssignmentChecklist[]
  >;
  saveCatalogAssignmentChecklist(
    checklist: CrossRunAuditCatalogAssignmentChecklist,
  ): Promise<CrossRunAuditCatalogAssignmentChecklist>;
}

export interface CrossRunAuditCatalogAssignmentChecklistView {
  readonly assignment: CrossRunAuditCatalogReviewAssignmentView;
  readonly checklist: CrossRunAuditCatalogAssignmentChecklist;
}

export interface CrossRunAuditCatalogAssignmentChecklistCollection {
  readonly items: readonly CrossRunAuditCatalogAssignmentChecklistView[];
  readonly totalCount: number;
}

export interface CrossRunAuditCatalogAssignmentChecklistApplication {
  readonly application: CrossRunAuditCatalogReviewAssignmentApplication;
  readonly checklist: CrossRunAuditCatalogAssignmentChecklistView;
}

export function createCrossRunAuditCatalogAssignmentChecklist(
  input: CreateCrossRunAuditCatalogAssignmentChecklistInput,
): CrossRunAuditCatalogAssignmentChecklist {
  const catalogEntryId = input.catalogEntryId.trim();
  const operatorId = input.operatorId.trim();
  const scopeId = input.scopeId.trim();
  const items = normalizeChecklistItems(input.items);

  if (catalogEntryId.length === 0) {
    throw new Error(
      "Catalog assignment checklists require a catalog entry id.",
    );
  }

  if (operatorId.length === 0) {
    throw new Error("Catalog assignment checklists require an operator id.");
  }

  if (scopeId.length === 0) {
    throw new Error("Catalog assignment checklists require a scope id.");
  }

  return {
    catalogEntryId,
    createdAt: input.timestamp,
    ...(items.length > 0 ? { items } : {}),
    kind: "catalog-assignment-checklist",
    operatorId,
    scopeId,
    state: input.state,
    updatedAt: input.timestamp,
  };
}

export function compareCrossRunAuditCatalogAssignmentChecklists(
  left: CrossRunAuditCatalogAssignmentChecklist,
  right: CrossRunAuditCatalogAssignmentChecklist,
): number {
  return (
    compareChecklistState(left, right) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.catalogEntryId.localeCompare(right.catalogEntryId)
  );
}

export function normalizeChecklistItems(
  items: readonly string[] | undefined,
): readonly string[] {
  if (!items) {
    return [];
  }

  const dedupedItems: string[] = [];

  for (const item of items) {
    const normalizedItem = item.trim();

    if (normalizedItem.length === 0 || dedupedItems.includes(normalizedItem)) {
      continue;
    }

    dedupedItems.push(normalizedItem);
  }

  return dedupedItems;
}

function compareChecklistState(
  left: CrossRunAuditCatalogAssignmentChecklist,
  right: CrossRunAuditCatalogAssignmentChecklist,
): number {
  const leftPriority = left.state === "pending" ? 0 : 1;
  const rightPriority = right.state === "pending" ? 0 : 1;

  return leftPriority - rightPriority;
}
