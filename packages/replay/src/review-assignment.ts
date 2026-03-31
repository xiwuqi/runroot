import type { CrossRunAuditCatalogReviewSignalView } from "./review-signal";
import type { CrossRunAuditCatalogVisibilityApplication } from "./visibility";

export type CrossRunAuditCatalogReviewAssignmentState = "assigned";

export interface CrossRunAuditCatalogReviewAssignment {
  readonly assigneeId: string;
  readonly assignerId: string;
  readonly catalogEntryId: string;
  readonly createdAt: string;
  readonly handoffNote?: string;
  readonly kind: "catalog-review-assignment";
  readonly scopeId: string;
  readonly state: CrossRunAuditCatalogReviewAssignmentState;
  readonly updatedAt: string;
}

export interface CreateCrossRunAuditCatalogReviewAssignmentInput {
  readonly assigneeId: string;
  readonly assignerId: string;
  readonly catalogEntryId: string;
  readonly handoffNote?: string;
  readonly scopeId: string;
  readonly timestamp: string;
}

export interface UpdateCrossRunAuditCatalogReviewAssignmentInput {
  readonly assigneeId: string;
  readonly handoffNote?: string;
}

export interface CrossRunAuditCatalogReviewAssignmentStore {
  deleteCatalogReviewAssignment(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogReviewAssignment | undefined>;
  getCatalogReviewAssignment(
    catalogEntryId: string,
  ): Promise<CrossRunAuditCatalogReviewAssignment | undefined>;
  listCatalogReviewAssignments(): Promise<
    readonly CrossRunAuditCatalogReviewAssignment[]
  >;
  saveCatalogReviewAssignment(
    assignment: CrossRunAuditCatalogReviewAssignment,
  ): Promise<CrossRunAuditCatalogReviewAssignment>;
}

export interface CrossRunAuditCatalogReviewAssignmentView {
  readonly assignment: CrossRunAuditCatalogReviewAssignment;
  readonly review: CrossRunAuditCatalogReviewSignalView;
}

export interface CrossRunAuditCatalogReviewAssignmentCollection {
  readonly items: readonly CrossRunAuditCatalogReviewAssignmentView[];
  readonly totalCount: number;
}

export interface CrossRunAuditCatalogReviewAssignmentApplication {
  readonly application: CrossRunAuditCatalogVisibilityApplication;
  readonly assignment: CrossRunAuditCatalogReviewAssignmentView;
}

export function createCrossRunAuditCatalogReviewAssignment(
  input: CreateCrossRunAuditCatalogReviewAssignmentInput,
): CrossRunAuditCatalogReviewAssignment {
  const assigneeId = input.assigneeId.trim();
  const assignerId = input.assignerId.trim();
  const catalogEntryId = input.catalogEntryId.trim();
  const handoffNote = input.handoffNote?.trim();
  const scopeId = input.scopeId.trim();

  if (catalogEntryId.length === 0) {
    throw new Error("Catalog review assignments require a catalog entry id.");
  }

  if (assignerId.length === 0) {
    throw new Error("Catalog review assignments require an assigner id.");
  }

  if (assigneeId.length === 0) {
    throw new Error("Catalog review assignments require an assignee id.");
  }

  if (scopeId.length === 0) {
    throw new Error("Catalog review assignments require a scope id.");
  }

  return {
    assigneeId,
    assignerId,
    catalogEntryId,
    createdAt: input.timestamp,
    ...(handoffNote ? { handoffNote } : {}),
    kind: "catalog-review-assignment",
    scopeId,
    state: "assigned",
    updatedAt: input.timestamp,
  };
}

export function compareCrossRunAuditCatalogReviewAssignments(
  left: CrossRunAuditCatalogReviewAssignment,
  right: CrossRunAuditCatalogReviewAssignment,
): number {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.catalogEntryId.localeCompare(right.catalogEntryId)
  );
}
