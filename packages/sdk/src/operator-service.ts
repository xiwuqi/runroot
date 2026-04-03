import { randomUUID } from "node:crypto";

import type { ApprovalActor, ApprovalRequest } from "@runroot/approvals";
import {
  type ExecutionMode,
  type PersistenceDriver,
  resolveExecutionMode,
  resolveOperatorIdentity,
  resolvePersistenceConfig,
  resolveWorkspacePath,
} from "@runroot/config";
import {
  type ApprovalDecisionOutcome,
  RuntimeEngine,
  RuntimeExecutionError,
} from "@runroot/core-runtime";
import type { DispatchQueue } from "@runroot/dispatch";
import type { JsonValue, WorkflowRun } from "@runroot/domain";
import type { RunrootLogger, RunrootTracer } from "@runroot/observability";
import {
  createConfiguredAuditCatalogAssignmentChecklistStore,
  createConfiguredAuditCatalogChecklistItemAttestationStore,
  createConfiguredAuditCatalogChecklistItemBlockerStore,
  createConfiguredAuditCatalogChecklistItemEvidenceStore,
  createConfiguredAuditCatalogChecklistItemProgressStore,
  createConfiguredAuditCatalogChecklistItemResolutionStore,
  createConfiguredAuditCatalogChecklistItemVerificationStore,
  createConfiguredAuditCatalogReviewAssignmentStore,
  createConfiguredAuditCatalogReviewSignalStore,
  createConfiguredAuditCatalogVisibilityStore,
  createConfiguredAuditViewCatalogStore,
  createConfiguredDispatchQueue,
  createConfiguredRuntimePersistence,
  createConfiguredSavedAuditViewStore,
  createConfiguredToolHistoryStore,
  type RuntimePersistence,
} from "@runroot/persistence";
import {
  type CrossRunAuditCatalogAssignmentChecklistCollection,
  type CrossRunAuditCatalogAssignmentChecklistState,
  type CrossRunAuditCatalogAssignmentChecklistStore,
  type CrossRunAuditCatalogAssignmentChecklistView,
  type CrossRunAuditCatalogChecklistItemAttestationCollection,
  type CrossRunAuditCatalogChecklistItemAttestationItem,
  type CrossRunAuditCatalogChecklistItemAttestationStore,
  type CrossRunAuditCatalogChecklistItemAttestationView,
  type CrossRunAuditCatalogChecklistItemBlockerCollection,
  type CrossRunAuditCatalogChecklistItemBlockerItem,
  type CrossRunAuditCatalogChecklistItemBlockerStore,
  type CrossRunAuditCatalogChecklistItemBlockerView,
  type CrossRunAuditCatalogChecklistItemEvidenceCollection,
  type CrossRunAuditCatalogChecklistItemEvidenceItem,
  type CrossRunAuditCatalogChecklistItemEvidenceStore,
  type CrossRunAuditCatalogChecklistItemEvidenceView,
  type CrossRunAuditCatalogChecklistItemProgressCollection,
  type CrossRunAuditCatalogChecklistItemProgressItem,
  type CrossRunAuditCatalogChecklistItemProgressStore,
  type CrossRunAuditCatalogChecklistItemProgressView,
  type CrossRunAuditCatalogChecklistItemResolutionCollection,
  type CrossRunAuditCatalogChecklistItemResolutionItem,
  type CrossRunAuditCatalogChecklistItemResolutionStore,
  type CrossRunAuditCatalogChecklistItemResolutionView,
  type CrossRunAuditCatalogChecklistItemVerificationCollection,
  type CrossRunAuditCatalogChecklistItemVerificationItem,
  type CrossRunAuditCatalogChecklistItemVerificationStore,
  type CrossRunAuditCatalogChecklistItemVerificationView,
  type CrossRunAuditCatalogEntryApplication,
  type CrossRunAuditCatalogEntryCollection,
  type CrossRunAuditCatalogEntryView,
  type CrossRunAuditCatalogReviewAssignmentCollection,
  type CrossRunAuditCatalogReviewAssignmentStore,
  type CrossRunAuditCatalogReviewAssignmentView,
  type CrossRunAuditCatalogReviewSignalCollection,
  type CrossRunAuditCatalogReviewSignalStore,
  type CrossRunAuditCatalogReviewSignalView,
  type CrossRunAuditCatalogReviewState,
  type CrossRunAuditCatalogStore,
  type CrossRunAuditCatalogVisibilityCollection,
  type CrossRunAuditCatalogVisibilityStore,
  type CrossRunAuditCatalogVisibilityView,
  type CrossRunAuditDrilldownFilters,
  type CrossRunAuditDrilldownResults,
  type CrossRunAuditNavigationFilters,
  type CrossRunAuditNavigationView,
  type CrossRunAuditQueryFilters,
  type CrossRunAuditResults,
  type CrossRunAuditSavedView,
  type CrossRunAuditSavedViewApplication,
  type CrossRunAuditSavedViewCollection,
  type CrossRunAuditSavedViewKind,
  type CrossRunAuditSavedViewNavigationRefs,
  type CrossRunAuditSavedViewStore,
  createCrossRunAuditCatalogAssignmentChecklistQuery,
  createCrossRunAuditCatalogChecklistItemAttestationQuery,
  createCrossRunAuditCatalogChecklistItemBlockerQuery,
  createCrossRunAuditCatalogChecklistItemEvidenceQuery,
  createCrossRunAuditCatalogChecklistItemProgressQuery,
  createCrossRunAuditCatalogChecklistItemResolutionQuery,
  createCrossRunAuditCatalogChecklistItemVerificationQuery,
  createCrossRunAuditCatalogQuery,
  createCrossRunAuditCatalogReviewAssignmentQuery,
  createCrossRunAuditCatalogReviewSignalQuery,
  createCrossRunAuditCatalogVisibilityQuery,
  createCrossRunAuditDrilldownQuery,
  createCrossRunAuditNavigationQuery,
  createCrossRunAuditQuery,
  createCrossRunAuditSavedView,
  createCrossRunAuditSavedViewQuery,
  createRunAuditQuery,
  createRunTimelineQuery,
  type RunAuditView,
  type RunTimeline,
  type RunTimelineQuery,
} from "@runroot/replay";
import {
  type CreateTemplateRuntimeBundleOptions,
  createTemplateRuntimeBundle,
  type TemplateCatalog,
  TemplateNotFoundError,
  type WorkflowTemplate,
  type WorkflowTemplateDescriptor,
} from "@runroot/templates";
import {
  type ToolHistoryEntry,
  type ToolHistoryStore,
  toolTelemetryMetadataKeys,
  validateToolValue,
  withToolInvocationMetadata,
} from "@runroot/tools";

import {
  OperatorConflictError,
  OperatorInputError,
  OperatorNotFoundError,
} from "./errors";
import { createToolTelemetryObserver } from "./tool-telemetry";

export interface StartTemplateRunInput {
  readonly input: JsonValue;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly templateId: string;
}

export interface DecideApprovalInput {
  readonly actor?: ApprovalActor;
  readonly decision: "approved" | "cancelled" | "rejected";
  readonly note?: string;
}

export interface PendingApprovalSummary {
  readonly approval: ApprovalRequest;
  readonly run: WorkflowRun;
}

export interface SaveAuditSavedViewInput {
  readonly description?: string;
  readonly kind?: CrossRunAuditSavedViewKind;
  readonly name: string;
  readonly navigation?: Partial<CrossRunAuditNavigationFilters>;
  readonly refs?: CrossRunAuditSavedViewNavigationRefs;
}

export interface PublishAuditViewCatalogEntryInput {
  readonly description?: string;
  readonly name?: string;
  readonly savedViewId: string;
}

export interface AssignAuditCatalogEntryInput {
  readonly assigneeId: string;
  readonly handoffNote?: string;
}

export interface ChecklistAuditCatalogEntryInput {
  readonly items?: readonly string[];
  readonly state: CrossRunAuditCatalogAssignmentChecklistState;
}

export interface ProgressAuditCatalogEntryInput {
  readonly completionNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemProgressItem[];
}

export interface BlockAuditCatalogEntryInput {
  readonly blockerNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemBlockerItem[];
}

export interface ResolveAuditCatalogEntryInput {
  readonly resolutionNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemResolutionItem[];
}

export interface VerifyAuditCatalogEntryInput {
  readonly verificationNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemVerificationItem[];
}

export interface RecordAuditCatalogEntryEvidenceInput {
  readonly evidenceNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemEvidenceItem[];
}

export interface AttestAuditCatalogEntryInput {
  readonly attestationNote?: string;
  readonly items: readonly CrossRunAuditCatalogChecklistItemAttestationItem[];
}

export interface ReviewAuditCatalogEntryInput {
  readonly note?: string;
  readonly state: CrossRunAuditCatalogReviewState;
}

export interface RunrootOperatorService {
  applyCatalogEntry(id: string): Promise<CrossRunAuditCatalogEntryApplication>;
  applySavedView(id: string): Promise<CrossRunAuditSavedViewApplication>;
  assignCatalogEntry(
    id: string,
    input: AssignAuditCatalogEntryInput,
  ): Promise<CrossRunAuditCatalogReviewAssignmentView>;
  blockCatalogEntry(
    id: string,
    input: BlockAuditCatalogEntryInput,
  ): Promise<CrossRunAuditCatalogChecklistItemBlockerView>;
  resolveCatalogEntry(
    id: string,
    input: ResolveAuditCatalogEntryInput,
  ): Promise<CrossRunAuditCatalogChecklistItemResolutionView>;
  verifyCatalogEntry(
    id: string,
    input: VerifyAuditCatalogEntryInput,
  ): Promise<CrossRunAuditCatalogChecklistItemVerificationView>;
  attestCatalogEntry(
    id: string,
    input: AttestAuditCatalogEntryInput,
  ): Promise<CrossRunAuditCatalogChecklistItemAttestationView>;
  recordCatalogEntryEvidence(
    id: string,
    input: RecordAuditCatalogEntryEvidenceInput,
  ): Promise<CrossRunAuditCatalogChecklistItemEvidenceView>;
  archiveCatalogEntry(id: string): Promise<CrossRunAuditCatalogEntryView>;
  checklistCatalogEntry(
    id: string,
    input: ChecklistAuditCatalogEntryInput,
  ): Promise<CrossRunAuditCatalogAssignmentChecklistView>;
  clearCatalogAssignmentChecklist(
    id: string,
  ): Promise<CrossRunAuditCatalogAssignmentChecklistView>;
  clearCatalogChecklistItemBlocker(
    id: string,
  ): Promise<CrossRunAuditCatalogChecklistItemBlockerView>;
  clearCatalogChecklistItemResolution(
    id: string,
  ): Promise<CrossRunAuditCatalogChecklistItemResolutionView>;
  clearCatalogChecklistItemAttestation(
    id: string,
  ): Promise<CrossRunAuditCatalogChecklistItemAttestationView>;
  clearCatalogChecklistItemEvidence(
    id: string,
  ): Promise<CrossRunAuditCatalogChecklistItemEvidenceView>;
  clearCatalogChecklistItemVerification(
    id: string,
  ): Promise<CrossRunAuditCatalogChecklistItemVerificationView>;
  clearCatalogChecklistItemProgress(
    id: string,
  ): Promise<CrossRunAuditCatalogChecklistItemProgressView>;
  clearCatalogReviewAssignment(
    id: string,
  ): Promise<CrossRunAuditCatalogReviewAssignmentView>;
  clearCatalogReviewSignal(
    id: string,
  ): Promise<CrossRunAuditCatalogReviewSignalView>;
  getCatalogAssignmentChecklist(
    id: string,
  ): Promise<CrossRunAuditCatalogAssignmentChecklistView>;
  getCatalogChecklistItemBlocker(
    id: string,
  ): Promise<CrossRunAuditCatalogChecklistItemBlockerView>;
  getCatalogChecklistItemResolution(
    id: string,
  ): Promise<CrossRunAuditCatalogChecklistItemResolutionView>;
  getCatalogChecklistItemAttestation(
    id: string,
  ): Promise<CrossRunAuditCatalogChecklistItemAttestationView>;
  getCatalogChecklistItemEvidence(
    id: string,
  ): Promise<CrossRunAuditCatalogChecklistItemEvidenceView>;
  getCatalogChecklistItemVerification(
    id: string,
  ): Promise<CrossRunAuditCatalogChecklistItemVerificationView>;
  getCatalogChecklistItemProgress(
    id: string,
  ): Promise<CrossRunAuditCatalogChecklistItemProgressView>;
  getCatalogEntry(id: string): Promise<CrossRunAuditCatalogEntryView>;
  getCatalogReviewAssignment(
    id: string,
  ): Promise<CrossRunAuditCatalogReviewAssignmentView>;
  getCatalogReviewSignal(
    id: string,
  ): Promise<CrossRunAuditCatalogReviewSignalView>;
  getCatalogVisibility(id: string): Promise<CrossRunAuditCatalogVisibilityView>;
  getAuditNavigation(
    filters?: Partial<CrossRunAuditNavigationFilters>,
  ): Promise<CrossRunAuditNavigationView>;
  getAuditView(runId: string): Promise<RunAuditView>;
  getSavedView(id: string): Promise<CrossRunAuditSavedView>;
  decideApproval(
    approvalId: string,
    input: DecideApprovalInput,
  ): Promise<ApprovalDecisionOutcome>;
  getApproval(approvalId: string): Promise<ApprovalRequest>;
  getApprovals(runId: string): Promise<readonly ApprovalRequest[]>;
  getPendingApprovals(): Promise<readonly PendingApprovalSummary[]>;
  getRun(runId: string): Promise<WorkflowRun>;
  getToolHistory(runId: string): Promise<readonly ToolHistoryEntry[]>;
  getTimeline(runId: string): Promise<RunTimeline>;
  getWorkspacePath(): string;
  listAuditDrilldowns(
    filters?: CrossRunAuditDrilldownFilters,
  ): Promise<CrossRunAuditDrilldownResults>;
  listAssignedCatalogEntries(): Promise<CrossRunAuditCatalogReviewAssignmentCollection>;
  listBlockedCatalogEntries(): Promise<CrossRunAuditCatalogChecklistItemBlockerCollection>;
  listChecklistedCatalogEntries(): Promise<CrossRunAuditCatalogAssignmentChecklistCollection>;
  listCatalogEntries(): Promise<CrossRunAuditCatalogEntryCollection>;
  listProgressedCatalogEntries(): Promise<CrossRunAuditCatalogChecklistItemProgressCollection>;
  listResolvedCatalogEntries(): Promise<CrossRunAuditCatalogChecklistItemResolutionCollection>;
  listAttestedCatalogEntries(): Promise<CrossRunAuditCatalogChecklistItemAttestationCollection>;
  listEvidencedCatalogEntries(): Promise<CrossRunAuditCatalogChecklistItemEvidenceCollection>;
  listVerifiedCatalogEntries(): Promise<CrossRunAuditCatalogChecklistItemVerificationCollection>;
  listReviewedCatalogEntries(): Promise<CrossRunAuditCatalogReviewSignalCollection>;
  listVisibleCatalogEntries(): Promise<CrossRunAuditCatalogVisibilityCollection>;
  listAuditResults(
    filters?: CrossRunAuditQueryFilters,
  ): Promise<CrossRunAuditResults>;
  listSavedViews(): Promise<CrossRunAuditSavedViewCollection>;
  listRuns(): Promise<readonly WorkflowRun[]>;
  listTemplates(): readonly WorkflowTemplateDescriptor[];
  publishCatalogEntry(
    input: PublishAuditViewCatalogEntryInput,
  ): Promise<CrossRunAuditCatalogEntryView>;
  progressCatalogEntry(
    id: string,
    input: ProgressAuditCatalogEntryInput,
  ): Promise<CrossRunAuditCatalogChecklistItemProgressView>;
  reviewCatalogEntry(
    id: string,
    input: ReviewAuditCatalogEntryInput,
  ): Promise<CrossRunAuditCatalogReviewSignalView>;
  resumeRun(runId: string): Promise<WorkflowRun>;
  saveSavedView(
    input: SaveAuditSavedViewInput,
  ): Promise<CrossRunAuditSavedView>;
  shareCatalogEntry(id: string): Promise<CrossRunAuditCatalogVisibilityView>;
  startRun(input: StartTemplateRunInput): Promise<WorkflowRun>;
  unshareCatalogEntry(id: string): Promise<CrossRunAuditCatalogVisibilityView>;
}

export interface RunrootOperatorServiceOptions {
  readonly approvalIdGenerator?: () => string;
  readonly catalogAssignmentChecklistStore?: CrossRunAuditCatalogAssignmentChecklistStore;
  readonly catalogChecklistItemAttestationStore?: CrossRunAuditCatalogChecklistItemAttestationStore;
  readonly catalogChecklistItemBlockerStore?: CrossRunAuditCatalogChecklistItemBlockerStore;
  readonly catalogChecklistItemEvidenceStore?: CrossRunAuditCatalogChecklistItemEvidenceStore;
  readonly catalogChecklistItemResolutionStore?: CrossRunAuditCatalogChecklistItemResolutionStore;
  readonly catalogChecklistItemVerificationStore?: CrossRunAuditCatalogChecklistItemVerificationStore;
  readonly catalogChecklistItemProgressStore?: CrossRunAuditCatalogChecklistItemProgressStore;
  readonly catalogEntryIdGenerator?: () => string;
  readonly catalogReviewAssignmentStore?: CrossRunAuditCatalogReviewAssignmentStore;
  readonly catalogReviewSignalStore?: CrossRunAuditCatalogReviewSignalStore;
  readonly catalogStore?: CrossRunAuditCatalogStore;
  readonly catalogVisibilityStore?: CrossRunAuditCatalogVisibilityStore;
  readonly databaseUrl?: string;
  readonly dispatchQueue?: DispatchQueue;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly executionMode?: ExecutionMode;
  readonly idGenerator?: (prefix: "run" | "step") => string;
  readonly logger?: RunrootLogger;
  readonly now?: () => string;
  readonly operatorId?: string;
  readonly operatorScopeId?: string;
  readonly persistence?: RuntimePersistence;
  readonly persistenceDriver?: PersistenceDriver;
  readonly savedViewIdGenerator?: () => string;
  readonly savedViewStore?: CrossRunAuditSavedViewStore;
  readonly sqlitePath?: string;
  readonly templates?: TemplateCatalog;
  readonly toolHistory?: ToolHistoryStore;
  readonly tracer?: RunrootTracer;
  readonly workspacePath?: string;
}

export function createRunrootOperatorService(
  options: RunrootOperatorServiceOptions = {},
): RunrootOperatorService {
  const now = options.now ?? (() => new Date().toISOString());
  const createCatalogEntryId =
    options.catalogEntryIdGenerator ?? (() => `catalog_entry_${randomUUID()}`);
  const createSavedViewId =
    options.savedViewIdGenerator ?? (() => `saved_view_${randomUUID()}`);
  const operatorIdentity = resolveOperatorIdentity({
    ...(options.env ? { env: options.env } : {}),
    ...(options.operatorId ? { operatorId: options.operatorId } : {}),
    ...(options.operatorScopeId ? { scopeId: options.operatorScopeId } : {}),
  });
  const persistenceConfig = resolvePersistenceConfig({
    ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
    ...(options.env ? { env: options.env } : {}),
    ...(options.persistenceDriver ? { driver: options.persistenceDriver } : {}),
    ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
    ...(options.workspacePath ? { workspacePath: options.workspacePath } : {}),
  });
  const persistence =
    options.persistence ??
    createConfiguredRuntimePersistence({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const toolHistory =
    options.toolHistory ??
    createConfiguredToolHistoryStore({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const savedViewStore =
    options.savedViewStore ??
    createConfiguredSavedAuditViewStore({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const catalogStore =
    options.catalogStore ??
    createConfiguredAuditViewCatalogStore({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const catalogVisibilityStore =
    options.catalogVisibilityStore ??
    createConfiguredAuditCatalogVisibilityStore({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const catalogReviewSignalStore =
    options.catalogReviewSignalStore ??
    createConfiguredAuditCatalogReviewSignalStore({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const catalogReviewAssignmentStore =
    options.catalogReviewAssignmentStore ??
    createConfiguredAuditCatalogReviewAssignmentStore({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const catalogAssignmentChecklistStore =
    options.catalogAssignmentChecklistStore ??
    createConfiguredAuditCatalogAssignmentChecklistStore({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const catalogChecklistItemProgressStore =
    options.catalogChecklistItemProgressStore ??
    createConfiguredAuditCatalogChecklistItemProgressStore({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const catalogChecklistItemBlockerStore =
    options.catalogChecklistItemBlockerStore ??
    createConfiguredAuditCatalogChecklistItemBlockerStore({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const catalogChecklistItemResolutionStore =
    options.catalogChecklistItemResolutionStore ??
    createConfiguredAuditCatalogChecklistItemResolutionStore({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const catalogChecklistItemVerificationStore =
    options.catalogChecklistItemVerificationStore ??
    createConfiguredAuditCatalogChecklistItemVerificationStore({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const catalogChecklistItemEvidenceStore =
    options.catalogChecklistItemEvidenceStore ??
    createConfiguredAuditCatalogChecklistItemEvidenceStore({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const catalogChecklistItemAttestationStore =
    options.catalogChecklistItemAttestationStore ??
    createConfiguredAuditCatalogChecklistItemAttestationStore({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const templateRuntimeOptions: CreateTemplateRuntimeBundleOptions = {
    toolObserver: createToolTelemetryObserver({
      history: toolHistory,
      ...(options.logger ? { logger: options.logger } : {}),
      surface: "operator",
      ...(options.tracer ? { tracer: options.tracer } : {}),
    }),
  };
  const templateRuntime = createTemplateRuntimeBundle(templateRuntimeOptions);
  const templates = options.templates ?? templateRuntime.templates;
  const executionMode = resolveExecutionMode({
    ...(options.env ? { env: options.env } : {}),
    ...(options.executionMode ? { executionMode: options.executionMode } : {}),
  });
  const dispatchReader =
    options.dispatchQueue ??
    (persistenceConfig.driver === "file"
      ? undefined
      : createConfiguredDispatchQueue({
          ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
          ...(options.env ? { env: options.env } : {}),
          ...(options.persistenceDriver
            ? { driver: options.persistenceDriver }
            : {}),
          ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
          ...(options.workspacePath
            ? { workspacePath: options.workspacePath }
            : {}),
        }));
  const dispatchQueue = executionMode === "queued" ? dispatchReader : undefined;
  const runtime = new RuntimeEngine({
    ...(options.approvalIdGenerator
      ? { approvalIdGenerator: options.approvalIdGenerator }
      : {}),
    ...(options.idGenerator ? { idGenerator: options.idGenerator } : {}),
    now,
    persistence,
    toolInvoker: withToolInvocationMetadata(templateRuntime.toolInvoker, {
      [toolTelemetryMetadataKeys.executionMode]: "inline",
    }),
  });
  const replay = createRunTimelineQuery({
    listByRunId: (runId) => runtime.getRunEvents(runId),
  });
  const audit = createRunAuditQuery({
    listByRunId: (runId) => runtime.getRunEvents(runId),
    async listDispatchJobsByRunId(runId) {
      return dispatchReader ? dispatchReader.listByRunId(runId) : [];
    },
    listToolHistoryByRunId: (runId) => toolHistory.listByRunId(runId),
  });
  const crossRunAudit = createCrossRunAuditQuery({
    listByRunId: (runId) => runtime.getRunEvents(runId),
    async listDispatchJobsByRunId(runId) {
      return dispatchReader ? dispatchReader.listByRunId(runId) : [];
    },
    async listRuns() {
      return runtime.listRuns();
    },
    listToolHistoryByRunId: (runId) => toolHistory.listByRunId(runId),
  });
  const crossRunAuditDrilldowns = createCrossRunAuditDrilldownQuery({
    listByRunId: (runId) => runtime.getRunEvents(runId),
    async listDispatchJobsByRunId(runId) {
      return dispatchReader ? dispatchReader.listByRunId(runId) : [];
    },
    async listRuns() {
      return runtime.listRuns();
    },
    listToolHistoryByRunId: (runId) => toolHistory.listByRunId(runId),
  });
  const crossRunAuditNavigation = createCrossRunAuditNavigationQuery({
    listByRunId: (runId) => runtime.getRunEvents(runId),
    async listDispatchJobsByRunId(runId) {
      return dispatchReader ? dispatchReader.listByRunId(runId) : [];
    },
    async listRuns() {
      return runtime.listRuns();
    },
    listToolHistoryByRunId: (runId) => toolHistory.listByRunId(runId),
  });
  const crossRunAuditSavedViews = createCrossRunAuditSavedViewQuery(
    savedViewStore,
    crossRunAuditNavigation,
  );
  const crossRunAuditCatalog = createCrossRunAuditCatalogQuery(
    catalogStore,
    crossRunAuditSavedViews,
  );
  const crossRunAuditCatalogVisibility =
    createCrossRunAuditCatalogVisibilityQuery(
      catalogVisibilityStore,
      crossRunAuditCatalog,
    );
  const crossRunAuditCatalogReviewSignals =
    createCrossRunAuditCatalogReviewSignalQuery(
      catalogReviewSignalStore,
      crossRunAuditCatalogVisibility,
    );
  const crossRunAuditCatalogReviewAssignments =
    createCrossRunAuditCatalogReviewAssignmentQuery(
      catalogReviewAssignmentStore,
      crossRunAuditCatalogReviewSignals,
      crossRunAuditCatalogVisibility,
    );
  const crossRunAuditCatalogAssignmentChecklists =
    createCrossRunAuditCatalogAssignmentChecklistQuery(
      catalogAssignmentChecklistStore,
      crossRunAuditCatalogReviewAssignments,
    );
  const crossRunAuditCatalogChecklistItemProgress =
    createCrossRunAuditCatalogChecklistItemProgressQuery(
      catalogChecklistItemProgressStore,
      crossRunAuditCatalogAssignmentChecklists,
    );
  const crossRunAuditCatalogChecklistItemBlockers =
    createCrossRunAuditCatalogChecklistItemBlockerQuery(
      catalogChecklistItemBlockerStore,
      crossRunAuditCatalogChecklistItemProgress,
    );
  const crossRunAuditCatalogChecklistItemResolutions =
    createCrossRunAuditCatalogChecklistItemResolutionQuery(
      catalogChecklistItemResolutionStore,
      crossRunAuditCatalogChecklistItemBlockers,
    );
  const crossRunAuditCatalogChecklistItemVerifications =
    createCrossRunAuditCatalogChecklistItemVerificationQuery(
      catalogChecklistItemVerificationStore,
      crossRunAuditCatalogChecklistItemResolutions,
    );
  const crossRunAuditCatalogChecklistItemEvidence =
    createCrossRunAuditCatalogChecklistItemEvidenceQuery(
      catalogChecklistItemEvidenceStore,
      crossRunAuditCatalogChecklistItemVerifications,
    );
  const crossRunAuditCatalogChecklistItemAttestations =
    createCrossRunAuditCatalogChecklistItemAttestationQuery(
      catalogChecklistItemAttestationStore,
      crossRunAuditCatalogChecklistItemEvidence,
    );
  const persistenceLocation = persistenceConfig.location;

  return {
    async applyCatalogEntry(id) {
      const application =
        await crossRunAuditCatalogVisibility.applyCatalogEntry(
          id,
          operatorIdentity,
        );

      if (!application) {
        throw new OperatorNotFoundError("catalog entry", id);
      }

      return application.application;
    },

    async applySavedView(id) {
      const application = await crossRunAuditSavedViews.applySavedView(id);

      if (!application) {
        throw new OperatorNotFoundError("saved view", id);
      }

      return application;
    },

    async assignCatalogEntry(id, input) {
      try {
        return await crossRunAuditCatalogReviewAssignments.setCatalogReviewAssignment(
          id,
          operatorIdentity,
          input,
          now(),
        );
      } catch (error) {
        throw normalizeCatalogReviewAssignmentError(error, id);
      }
    },

    async blockCatalogEntry(id, input) {
      try {
        return await crossRunAuditCatalogChecklistItemBlockers.setCatalogChecklistItemBlocker(
          id,
          operatorIdentity,
          input,
          now(),
        );
      } catch (error) {
        throw normalizeCatalogChecklistItemBlockerError(error, id);
      }
    },

    async resolveCatalogEntry(id, input) {
      try {
        return await crossRunAuditCatalogChecklistItemResolutions.setCatalogChecklistItemResolution(
          id,
          operatorIdentity,
          input,
          now(),
        );
      } catch (error) {
        throw normalizeCatalogChecklistItemResolutionError(error, id);
      }
    },

    async verifyCatalogEntry(id, input) {
      try {
        return await crossRunAuditCatalogChecklistItemVerifications.setCatalogChecklistItemVerification(
          id,
          operatorIdentity,
          input,
          now(),
        );
      } catch (error) {
        throw normalizeCatalogChecklistItemVerificationError(error, id);
      }
    },

    async attestCatalogEntry(id, input) {
      try {
        return await crossRunAuditCatalogChecklistItemAttestations.setCatalogChecklistItemAttestation(
          id,
          operatorIdentity,
          input,
          now(),
        );
      } catch (error) {
        throw normalizeCatalogChecklistItemAttestationError(error, id);
      }
    },

    async recordCatalogEntryEvidence(id, input) {
      try {
        return await crossRunAuditCatalogChecklistItemEvidence.setCatalogChecklistItemEvidence(
          id,
          operatorIdentity,
          input,
          now(),
        );
      } catch (error) {
        throw normalizeCatalogChecklistItemEvidenceError(error, id);
      }
    },

    async archiveCatalogEntry(id) {
      const visibility = await requireOwnedCatalogVisibility(
        id,
        operatorIdentity.operatorId,
        catalogVisibilityStore,
      );
      const catalogEntry = await crossRunAuditCatalog.archiveCatalogEntry(
        visibility.catalogEntryId,
        now(),
      );

      if (!catalogEntry) {
        throw new OperatorNotFoundError("catalog entry", id);
      }

      return catalogEntry;
    },

    async checklistCatalogEntry(id, input) {
      try {
        return await crossRunAuditCatalogAssignmentChecklists.setCatalogAssignmentChecklist(
          id,
          operatorIdentity,
          input,
          now(),
        );
      } catch (error) {
        throw normalizeCatalogAssignmentChecklistError(error, id);
      }
    },

    async clearCatalogAssignmentChecklist(id) {
      const checklist =
        await crossRunAuditCatalogAssignmentChecklists.clearCatalogAssignmentChecklist(
          id,
          operatorIdentity,
        );

      if (!checklist) {
        throw new OperatorNotFoundError("catalog assignment checklist", id);
      }

      return checklist;
    },

    async clearCatalogChecklistItemBlocker(id) {
      const blocker =
        await crossRunAuditCatalogChecklistItemBlockers.clearCatalogChecklistItemBlocker(
          id,
          operatorIdentity,
        );

      if (!blocker) {
        throw new OperatorNotFoundError("catalog checklist item blocker", id);
      }

      return blocker;
    },

    async clearCatalogChecklistItemResolution(id) {
      const resolution =
        await crossRunAuditCatalogChecklistItemResolutions.clearCatalogChecklistItemResolution(
          id,
          operatorIdentity,
        );

      if (!resolution) {
        throw new OperatorNotFoundError(
          "catalog checklist item resolution",
          id,
        );
      }

      return resolution;
    },

    async clearCatalogChecklistItemAttestation(id) {
      const attestation =
        await crossRunAuditCatalogChecklistItemAttestations.clearCatalogChecklistItemAttestation(
          id,
          operatorIdentity,
        );

      if (!attestation) {
        throw new OperatorNotFoundError(
          "catalog checklist item attestation",
          id,
        );
      }

      return attestation;
    },

    async clearCatalogChecklistItemEvidence(id) {
      const evidence =
        await crossRunAuditCatalogChecklistItemEvidence.clearCatalogChecklistItemEvidence(
          id,
          operatorIdentity,
        );

      if (!evidence) {
        throw new OperatorNotFoundError("catalog checklist item evidence", id);
      }

      return evidence;
    },

    async clearCatalogChecklistItemVerification(id) {
      const verification =
        await crossRunAuditCatalogChecklistItemVerifications.clearCatalogChecklistItemVerification(
          id,
          operatorIdentity,
        );

      if (!verification) {
        throw new OperatorNotFoundError(
          "catalog checklist item verification",
          id,
        );
      }

      return verification;
    },

    async clearCatalogChecklistItemProgress(id) {
      const progress =
        await crossRunAuditCatalogChecklistItemProgress.clearCatalogChecklistItemProgress(
          id,
          operatorIdentity,
        );

      if (!progress) {
        throw new OperatorNotFoundError("catalog checklist item progress", id);
      }

      return progress;
    },

    async clearCatalogReviewAssignment(id) {
      const assignment =
        await crossRunAuditCatalogReviewAssignments.clearCatalogReviewAssignment(
          id,
          operatorIdentity,
        );

      if (!assignment) {
        throw new OperatorNotFoundError("catalog review assignment", id);
      }

      return assignment;
    },

    async clearCatalogReviewSignal(id) {
      const review =
        await crossRunAuditCatalogReviewSignals.clearCatalogReviewSignal(
          id,
          operatorIdentity,
        );

      if (!review) {
        throw new OperatorNotFoundError("catalog review signal", id);
      }

      return review;
    },

    async decideApproval(approvalId, input) {
      const approval = await runtime.getApproval(approvalId);

      if (!approval) {
        throw new OperatorNotFoundError("approval", approvalId);
      }

      try {
        return await runtime.decideApproval(approvalId, input);
      } catch (error) {
        throw normalizeOperatorError(error);
      }
    },

    async getApproval(approvalId) {
      const approval = await runtime.getApproval(approvalId);

      if (!approval) {
        throw new OperatorNotFoundError("approval", approvalId);
      }

      return approval;
    },

    async getApprovals(runId) {
      await requireRun(runtime, runId);

      return runtime.getApprovals(runId);
    },

    async getAuditNavigation(filters) {
      return crossRunAuditNavigation.getAuditNavigation(filters);
    },

    async getAuditView(runId) {
      await requireRun(runtime, runId);

      return audit.getAuditView(runId);
    },

    async getCatalogEntry(id) {
      const catalogVisibility =
        await crossRunAuditCatalogVisibility.getCatalogVisibility(
          id,
          operatorIdentity,
        );

      if (!catalogVisibility) {
        throw new OperatorNotFoundError("catalog entry", id);
      }

      return catalogVisibility.catalogEntry;
    },

    async getCatalogAssignmentChecklist(id) {
      const checklist =
        await crossRunAuditCatalogAssignmentChecklists.getCatalogAssignmentChecklist(
          id,
          operatorIdentity,
        );

      if (!checklist) {
        throw new OperatorNotFoundError("catalog assignment checklist", id);
      }

      return checklist;
    },

    async getCatalogChecklistItemBlocker(id) {
      const blocker =
        await crossRunAuditCatalogChecklistItemBlockers.getCatalogChecklistItemBlocker(
          id,
          operatorIdentity,
        );

      if (!blocker) {
        throw new OperatorNotFoundError("catalog checklist item blocker", id);
      }

      return blocker;
    },

    async getCatalogChecklistItemResolution(id) {
      const resolution =
        await crossRunAuditCatalogChecklistItemResolutions.getCatalogChecklistItemResolution(
          id,
          operatorIdentity,
        );

      if (!resolution) {
        throw new OperatorNotFoundError(
          "catalog checklist item resolution",
          id,
        );
      }

      return resolution;
    },

    async getCatalogChecklistItemAttestation(id) {
      const attestation =
        await crossRunAuditCatalogChecklistItemAttestations.getCatalogChecklistItemAttestation(
          id,
          operatorIdentity,
        );

      if (!attestation) {
        throw new OperatorNotFoundError(
          "catalog checklist item attestation",
          id,
        );
      }

      return attestation;
    },

    async getCatalogChecklistItemEvidence(id) {
      const evidence =
        await crossRunAuditCatalogChecklistItemEvidence.getCatalogChecklistItemEvidence(
          id,
          operatorIdentity,
        );

      if (!evidence) {
        throw new OperatorNotFoundError("catalog checklist item evidence", id);
      }

      return evidence;
    },

    async getCatalogChecklistItemVerification(id) {
      const verification =
        await crossRunAuditCatalogChecklistItemVerifications.getCatalogChecklistItemVerification(
          id,
          operatorIdentity,
        );

      if (!verification) {
        throw new OperatorNotFoundError(
          "catalog checklist item verification",
          id,
        );
      }

      return verification;
    },

    async getCatalogChecklistItemProgress(id) {
      const progress =
        await crossRunAuditCatalogChecklistItemProgress.getCatalogChecklistItemProgress(
          id,
          operatorIdentity,
        );

      if (!progress) {
        throw new OperatorNotFoundError("catalog checklist item progress", id);
      }

      return progress;
    },

    async getCatalogReviewAssignment(id) {
      const assignment =
        await crossRunAuditCatalogReviewAssignments.getCatalogReviewAssignment(
          id,
          operatorIdentity,
        );

      if (!assignment) {
        throw new OperatorNotFoundError("catalog review assignment", id);
      }

      return assignment;
    },

    async getCatalogReviewSignal(id) {
      const review =
        await crossRunAuditCatalogReviewSignals.getCatalogReviewSignal(
          id,
          operatorIdentity,
        );

      if (!review) {
        throw new OperatorNotFoundError("catalog review signal", id);
      }

      return review;
    },

    async getCatalogVisibility(id) {
      const catalogVisibility =
        await crossRunAuditCatalogVisibility.getCatalogVisibility(
          id,
          operatorIdentity,
        );

      if (!catalogVisibility) {
        throw new OperatorNotFoundError("catalog visibility", id);
      }

      return catalogVisibility;
    },

    async getSavedView(id) {
      const savedView = await crossRunAuditSavedViews.getSavedView(id);

      if (!savedView) {
        throw new OperatorNotFoundError("saved view", id);
      }

      return savedView;
    },

    async getPendingApprovals() {
      const runs = await runtime.listRuns();
      const pendingApprovals: PendingApprovalSummary[] = [];

      for (const run of runs) {
        const approval = await runtime.getPendingApproval(run.id);

        if (approval) {
          pendingApprovals.push({
            approval,
            run,
          });
        }
      }

      return pendingApprovals;
    },

    async getRun(runId) {
      return requireRun(runtime, runId);
    },

    async getToolHistory(runId) {
      await requireRun(runtime, runId);

      return toolHistory.listByRunId(runId);
    },

    async getTimeline(runId) {
      await requireRun(runtime, runId);

      return replay.getTimeline(runId);
    },

    getWorkspacePath() {
      return persistenceLocation;
    },

    async listAuditDrilldowns(filters) {
      return crossRunAuditDrilldowns.listAuditDrilldowns(filters);
    },

    async listAssignedCatalogEntries() {
      return crossRunAuditCatalogReviewAssignments.listAssignedCatalogEntries(
        operatorIdentity,
      );
    },

    async listBlockedCatalogEntries() {
      return crossRunAuditCatalogChecklistItemBlockers.listBlockedCatalogEntries(
        operatorIdentity,
      );
    },

    async listResolvedCatalogEntries() {
      return crossRunAuditCatalogChecklistItemResolutions.listResolvedCatalogEntries(
        operatorIdentity,
      );
    },

    async listAttestedCatalogEntries() {
      return crossRunAuditCatalogChecklistItemAttestations.listAttestedCatalogEntries(
        operatorIdentity,
      );
    },

    async listEvidencedCatalogEntries() {
      return crossRunAuditCatalogChecklistItemEvidence.listEvidencedCatalogEntries(
        operatorIdentity,
      );
    },

    async listVerifiedCatalogEntries() {
      return crossRunAuditCatalogChecklistItemVerifications.listVerifiedCatalogEntries(
        operatorIdentity,
      );
    },

    async listChecklistedCatalogEntries() {
      return crossRunAuditCatalogAssignmentChecklists.listChecklistedCatalogEntries(
        operatorIdentity,
      );
    },

    async listCatalogEntries() {
      const visibleCatalogEntries =
        await crossRunAuditCatalogVisibility.listVisibleCatalogEntries(
          operatorIdentity,
        );

      return {
        items: visibleCatalogEntries.items.map((item) => item.catalogEntry),
        totalCount: visibleCatalogEntries.totalCount,
      };
    },

    async listProgressedCatalogEntries() {
      return crossRunAuditCatalogChecklistItemProgress.listProgressedCatalogEntries(
        operatorIdentity,
      );
    },

    async listReviewedCatalogEntries() {
      return crossRunAuditCatalogReviewSignals.listReviewedCatalogEntries(
        operatorIdentity,
      );
    },

    async listVisibleCatalogEntries() {
      return crossRunAuditCatalogVisibility.listVisibleCatalogEntries(
        operatorIdentity,
      );
    },

    async listAuditResults(filters) {
      return crossRunAudit.listAuditResults(filters);
    },

    async listSavedViews() {
      return crossRunAuditSavedViews.listSavedViews();
    },

    async listRuns() {
      return runtime.listRuns();
    },

    listTemplates() {
      return templates.list().map((template) => template.descriptor);
    },

    async publishCatalogEntry(input) {
      const savedView = await crossRunAuditSavedViews.getSavedView(
        input.savedViewId,
      );

      if (!savedView) {
        throw new OperatorNotFoundError("saved view", input.savedViewId);
      }

      try {
        const catalogEntry = await crossRunAuditCatalog.publishCatalogEntry({
          ...(input.description ? { description: input.description } : {}),
          id: createCatalogEntryId(),
          ...(input.name ? { name: input.name } : {}),
          savedViewId: savedView.id,
          timestamp: now(),
        });

        await crossRunAuditCatalogVisibility.setCatalogVisibilityState(
          catalogEntry.entry.id,
          operatorIdentity,
          "personal",
          catalogEntry.entry.createdAt,
        );

        return catalogEntry;
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("Catalog entries require")
        ) {
          throw new OperatorInputError(error.message);
        }

        throw normalizeOperatorError(error);
      }
    },

    async progressCatalogEntry(id, input) {
      try {
        return await crossRunAuditCatalogChecklistItemProgress.setCatalogChecklistItemProgress(
          id,
          operatorIdentity,
          input,
          now(),
        );
      } catch (error) {
        throw normalizeCatalogChecklistItemProgressError(error, id);
      }
    },

    async reviewCatalogEntry(id, input) {
      try {
        return await crossRunAuditCatalogReviewSignals.setCatalogReviewSignal(
          id,
          operatorIdentity,
          input,
          now(),
        );
      } catch (error) {
        throw normalizeCatalogReviewSignalError(error, id);
      }
    },

    async resumeRun(runId) {
      const run = await requireRun(runtime, runId);
      const template = templates.get(run.definitionId);

      if (!template) {
        throw new OperatorNotFoundError("template", run.definitionId);
      }

      try {
        if (executionMode === "queued") {
          if (run.status !== "paused") {
            return run;
          }

          const pendingApproval = await runtime.getPendingApproval(run.id);

          if (pendingApproval) {
            throw new RuntimeExecutionError(
              `Run "${run.id}" is waiting on approval "${pendingApproval.id}" and cannot resume until the decision is recorded.`,
            );
          }

          await dispatchQueue?.enqueue({
            definitionId: template.definition.id,
            enqueuedAt: now(),
            kind: "resume_run",
            runId,
          });

          return runtime.queueResumeRun(template.definition, runId);
        }

        return await runtime.resumeRun(template.definition, runId);
      } catch (error) {
        throw normalizeOperatorError(error);
      }
    },

    async saveSavedView(input) {
      try {
        return await crossRunAuditSavedViews.saveSavedView(
          createCrossRunAuditSavedView({
            ...(input.description ? { description: input.description } : {}),
            id: createSavedViewId(),
            ...(input.kind ? { kind: input.kind } : {}),
            name: input.name,
            ...(input.navigation ? { navigation: input.navigation } : {}),
            ...(input.refs ? { refs: input.refs } : {}),
            timestamp: now(),
          }),
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("Saved audit views require")
        ) {
          throw new OperatorInputError(error.message);
        }

        throw normalizeOperatorError(error);
      }
    },

    async shareCatalogEntry(id) {
      try {
        return await crossRunAuditCatalogVisibility.setCatalogVisibilityState(
          id,
          operatorIdentity,
          "shared",
          now(),
        );
      } catch (error) {
        throw normalizeCatalogVisibilityError(error, id);
      }
    },

    async startRun(input) {
      const template = requireTemplate(templates, input.templateId);
      assertValidTemplateInput(template, input.input);
      const run = await runtime.createRun(template.definition, input.input, {
        metadata: {
          ...(input.metadata ?? {}),
          templateId: template.descriptor.id,
        },
      });

      if (executionMode === "queued") {
        await dispatchQueue?.enqueue({
          definitionId: template.definition.id,
          enqueuedAt: now(),
          kind: "start_run",
          runId: run.id,
        });

        return runtime.queueRun(template.definition, run.id);
      }

      return runtime.executeRun(template.definition, run.id);
    },

    async unshareCatalogEntry(id) {
      try {
        return await crossRunAuditCatalogVisibility.setCatalogVisibilityState(
          id,
          operatorIdentity,
          "personal",
          now(),
        );
      } catch (error) {
        throw normalizeCatalogVisibilityError(error, id);
      }
    },
  };
}

export function createRunTimelineService(
  reader: RunTimelineQuery,
): Pick<RunrootOperatorService, "getTimeline"> {
  return {
    getTimeline(runId) {
      return reader.getTimeline(runId);
    },
  };
}

function requireTemplate(
  templates: TemplateCatalog,
  templateId: string,
): WorkflowTemplate {
  try {
    return templates.require(templateId);
  } catch (error) {
    if (error instanceof TemplateNotFoundError) {
      throw new OperatorNotFoundError("template", templateId);
    }

    throw error;
  }
}

function assertValidTemplateInput(
  template: WorkflowTemplate,
  input: JsonValue,
): void {
  const issues = validateToolValue(
    input,
    template.descriptor.inputSchema,
    "templateInput",
  );

  if (issues.length > 0) {
    throw new OperatorInputError(
      `Template "${template.descriptor.id}" received invalid input: ${issues.join(" ")}`,
    );
  }
}

async function requireRun(
  runtime: RuntimeEngine,
  runId: string,
): Promise<WorkflowRun> {
  const run = await runtime.getRun(runId);

  if (!run) {
    throw new OperatorNotFoundError("run", runId);
  }

  return run;
}

async function requireOwnedCatalogVisibility(
  catalogEntryId: string,
  operatorId: string,
  store: CrossRunAuditCatalogVisibilityStore,
): Promise<CrossRunAuditCatalogVisibilityView["visibility"]> {
  const visibility = await store.getCatalogVisibility(catalogEntryId);

  if (!visibility) {
    throw new OperatorNotFoundError("catalog visibility", catalogEntryId);
  }

  if (visibility.ownerId !== operatorId) {
    throw new OperatorConflictError(
      `Catalog entry "${catalogEntryId}" is owned by "${visibility.ownerId}" and cannot be archived by "${operatorId}".`,
    );
  }

  return visibility;
}

function normalizeCatalogVisibilityError(
  error: unknown,
  catalogEntryId: string,
): Error {
  if (
    error instanceof OperatorConflictError ||
    error instanceof OperatorInputError ||
    error instanceof OperatorNotFoundError
  ) {
    return error;
  }

  if (
    error instanceof Error &&
    error.message.startsWith(`Catalog entry "${catalogEntryId}" was not found.`)
  ) {
    return new OperatorNotFoundError("catalog entry", catalogEntryId);
  }

  if (
    error instanceof Error &&
    error.message.includes("can only be updated by owner")
  ) {
    return new OperatorConflictError(error.message);
  }

  return normalizeOperatorError(error);
}

function normalizeCatalogReviewAssignmentError(
  error: unknown,
  catalogEntryId: string,
): Error {
  if (
    error instanceof OperatorConflictError ||
    error instanceof OperatorInputError ||
    error instanceof OperatorNotFoundError
  ) {
    return error;
  }

  if (
    error instanceof Error &&
    error.message.startsWith("Catalog review assignments require")
  ) {
    return new OperatorInputError(error.message);
  }

  if (
    error instanceof Error &&
    error.message.startsWith(
      `Catalog entry "${catalogEntryId}" is not reviewed and visible to operator`,
    )
  ) {
    return new OperatorNotFoundError(
      "catalog review assignment",
      catalogEntryId,
    );
  }

  return normalizeOperatorError(error);
}

function normalizeCatalogAssignmentChecklistError(
  error: unknown,
  catalogEntryId: string,
): Error {
  if (
    error instanceof OperatorConflictError ||
    error instanceof OperatorInputError ||
    error instanceof OperatorNotFoundError
  ) {
    return error;
  }

  if (
    error instanceof Error &&
    error.message.startsWith("Catalog assignment checklists require")
  ) {
    return new OperatorInputError(error.message);
  }

  if (
    error instanceof Error &&
    error.message.startsWith(
      `Catalog entry "${catalogEntryId}" is not assigned and visible to operator`,
    )
  ) {
    return new OperatorNotFoundError(
      "catalog assignment checklist",
      catalogEntryId,
    );
  }

  return normalizeOperatorError(error);
}

function normalizeCatalogChecklistItemProgressError(
  error: unknown,
  catalogEntryId: string,
): Error {
  if (
    error instanceof OperatorConflictError ||
    error instanceof OperatorInputError ||
    error instanceof OperatorNotFoundError
  ) {
    return error;
  }

  if (
    error instanceof Error &&
    (error.message.startsWith("Catalog checklist item progress requires") ||
      error.message.startsWith(`Catalog checklist item progress item "`) ||
      error.message.startsWith(
        `Catalog entry "${catalogEntryId}" does not define assignment checklist items`,
      ))
  ) {
    return new OperatorInputError(error.message);
  }

  if (
    error instanceof Error &&
    error.message.startsWith(
      `Catalog entry "${catalogEntryId}" is not checklisted and visible to operator`,
    )
  ) {
    return new OperatorNotFoundError(
      "catalog checklist item progress",
      catalogEntryId,
    );
  }

  return normalizeOperatorError(error);
}

function normalizeCatalogChecklistItemBlockerError(
  error: unknown,
  catalogEntryId: string,
): Error {
  if (
    error instanceof OperatorConflictError ||
    error instanceof OperatorInputError ||
    error instanceof OperatorNotFoundError
  ) {
    return error;
  }

  if (
    error instanceof Error &&
    (error.message.startsWith("Catalog checklist item blockers require") ||
      error.message.startsWith(`Catalog checklist item blocker "`) ||
      error.message.startsWith(
        `Catalog entry "${catalogEntryId}" does not define checklist item progress entries`,
      ))
  ) {
    return new OperatorInputError(error.message);
  }

  if (
    error instanceof Error &&
    error.message.startsWith(
      `Catalog entry "${catalogEntryId}" is not progressed and visible to operator`,
    )
  ) {
    return new OperatorNotFoundError(
      "catalog checklist item blocker",
      catalogEntryId,
    );
  }

  return normalizeOperatorError(error);
}

function normalizeCatalogChecklistItemResolutionError(
  error: unknown,
  catalogEntryId: string,
): Error {
  if (
    error instanceof OperatorConflictError ||
    error instanceof OperatorInputError ||
    error instanceof OperatorNotFoundError
  ) {
    return error;
  }

  if (
    error instanceof Error &&
    (error.message.startsWith("Catalog checklist item resolutions require") ||
      error.message.startsWith(`Catalog checklist item resolution "`) ||
      error.message.startsWith(
        `Catalog entry "${catalogEntryId}" does not define checklist item blocker entries`,
      ))
  ) {
    return new OperatorInputError(error.message);
  }

  if (
    error instanceof Error &&
    error.message.startsWith(
      `Catalog entry "${catalogEntryId}" is not blocked and visible to operator`,
    )
  ) {
    return new OperatorNotFoundError(
      "catalog checklist item resolution",
      catalogEntryId,
    );
  }

  return normalizeOperatorError(error);
}

function normalizeCatalogChecklistItemVerificationError(
  error: unknown,
  catalogEntryId: string,
): Error {
  if (
    error instanceof OperatorConflictError ||
    error instanceof OperatorInputError ||
    error instanceof OperatorNotFoundError
  ) {
    return error;
  }

  if (
    error instanceof Error &&
    (error.message.startsWith("Catalog checklist item verifications require") ||
      error.message.startsWith(`Catalog checklist item verification "`) ||
      error.message.startsWith(
        `Catalog entry "${catalogEntryId}" does not define checklist item resolution entries`,
      ))
  ) {
    return new OperatorInputError(error.message);
  }

  if (
    error instanceof Error &&
    error.message.startsWith(
      `Catalog entry "${catalogEntryId}" is not resolved and visible to operator`,
    )
  ) {
    return new OperatorNotFoundError(
      "catalog checklist item verification",
      catalogEntryId,
    );
  }

  return normalizeOperatorError(error);
}

function normalizeCatalogChecklistItemEvidenceError(
  error: unknown,
  catalogEntryId: string,
): Error {
  if (
    error instanceof OperatorConflictError ||
    error instanceof OperatorInputError ||
    error instanceof OperatorNotFoundError
  ) {
    return error;
  }

  if (
    error instanceof Error &&
    (error.message.startsWith("Catalog checklist item evidence requires") ||
      error.message.startsWith(`Catalog checklist item evidence "`) ||
      error.message.startsWith(
        `Catalog entry "${catalogEntryId}" does not define checklist item verification entries`,
      ))
  ) {
    return new OperatorInputError(error.message);
  }

  if (
    error instanceof Error &&
    error.message.startsWith(
      `Catalog entry "${catalogEntryId}" is not verified and visible to operator`,
    )
  ) {
    return new OperatorNotFoundError(
      "catalog checklist item evidence",
      catalogEntryId,
    );
  }

  return normalizeOperatorError(error);
}

function normalizeCatalogChecklistItemAttestationError(
  error: unknown,
  catalogEntryId: string,
): Error {
  if (
    error instanceof OperatorConflictError ||
    error instanceof OperatorInputError ||
    error instanceof OperatorNotFoundError
  ) {
    return error;
  }

  if (
    error instanceof Error &&
    (error.message.startsWith("Catalog checklist item attestations require") ||
      error.message.startsWith(`Catalog checklist item attestation "`) ||
      error.message.startsWith(
        `Catalog entry "${catalogEntryId}" does not define checklist item evidence entries`,
      ))
  ) {
    return new OperatorInputError(error.message);
  }

  if (
    error instanceof Error &&
    error.message.startsWith(
      `Catalog entry "${catalogEntryId}" is not evidenced and visible to operator`,
    )
  ) {
    return new OperatorNotFoundError(
      "catalog checklist item attestation",
      catalogEntryId,
    );
  }

  return normalizeOperatorError(error);
}

function normalizeCatalogReviewSignalError(
  error: unknown,
  catalogEntryId: string,
): Error {
  if (
    error instanceof OperatorConflictError ||
    error instanceof OperatorInputError ||
    error instanceof OperatorNotFoundError
  ) {
    return error;
  }

  if (
    error instanceof Error &&
    error.message.startsWith("Catalog review signals require")
  ) {
    return new OperatorInputError(error.message);
  }

  if (
    error instanceof Error &&
    error.message.startsWith(
      `Catalog entry "${catalogEntryId}" is not visible to operator`,
    )
  ) {
    return new OperatorNotFoundError("catalog entry", catalogEntryId);
  }

  return normalizeOperatorError(error);
}

function normalizeOperatorError(error: unknown): Error {
  if (
    error instanceof OperatorConflictError ||
    error instanceof OperatorInputError ||
    error instanceof OperatorNotFoundError
  ) {
    return error;
  }

  if (error instanceof RuntimeExecutionError) {
    return new OperatorConflictError(error.message);
  }

  return error instanceof Error ? error : new Error(String(error));
}

export { resolveWorkspacePath };
