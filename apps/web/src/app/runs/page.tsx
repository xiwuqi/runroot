import {
  AssignmentChecklistsView,
  AuditViewCatalogsView,
  CatalogReviewAssignmentsView,
  CatalogReviewSignalsView,
  ChecklistItemBlockersView,
  ChecklistItemEvidencesView,
  ChecklistItemProgressView,
  ChecklistItemResolutionsView,
  ChecklistItemVerificationsView,
  ConsoleShell,
  CrossRunAuditNavigationView,
  ErrorState,
  FlashBanner,
  RunsListView,
  SavedAuditViewsView,
} from "../../components/console";
import {
  getFlashMessage,
  type PageSearchParams,
  resolvePageSearchParams,
} from "../../lib/navigation";
import {
  type ApiAuditCatalogAssignmentChecklistView,
  type ApiAuditCatalogChecklistItemBlockerView,
  type ApiAuditCatalogChecklistItemEvidenceView,
  type ApiAuditCatalogChecklistItemProgressView,
  type ApiAuditCatalogChecklistItemResolutionView,
  type ApiAuditCatalogChecklistItemVerificationView,
  type ApiAuditCatalogEntryApplication,
  type ApiAuditCatalogReviewAssignmentView,
  type ApiAuditCatalogReviewSignalView,
  type ApiAuditCatalogVisibilityView,
  type ApiAuditNavigationFilters,
  type ApiAuditNavigationView,
  type ApiAuditSavedView,
  type ApiAuditSavedViewApplication,
  type ApiRun,
  createRunrootApiClient,
  RunrootApiError,
} from "../../lib/runroot-api";

export const dynamic = "force-dynamic";

export default async function RunsPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<PageSearchParams>;
}>) {
  const resolvedSearchParams = await resolvePageSearchParams(searchParams);
  const flash = getFlashMessage(resolvedSearchParams);
  const api = createRunrootApiClient();

  try {
    const catalogEntryId = readFirstSearchParam(
      resolvedSearchParams.catalogEntryId,
    );
    const savedViewId = readFirstSearchParam(resolvedSearchParams.savedViewId);
    const auditFilters = readAuditFilters(resolvedSearchParams);
    const drilldownFilters = readAuditDrilldownFilters(resolvedSearchParams);
    const [
      runs,
      blockedEntries,
      evidencedEntries,
      resolvedEntries,
      verifiedEntries,
      progressedEntries,
      checklistedEntries,
      assignedEntries,
      reviewedEntries,
      catalogEntries,
      savedViews,
      navigationResult,
      catalogVisibility,
      catalogChecklistItemBlocker,
      catalogChecklistItemResolution,
      catalogChecklistItemEvidence,
      catalogChecklistItemVerification,
      catalogChecklistItemProgress,
      catalogAssignmentChecklist,
      catalogReviewSignal,
      catalogReviewAssignment,
    ] = await Promise.all([
      api.listRuns(),
      api.listBlockedAuditCatalogEntries(),
      api.listEvidencedAuditCatalogEntries(),
      api.listResolvedAuditCatalogEntries(),
      api.listVerifiedAuditCatalogEntries(),
      api.listProgressedAuditCatalogEntries(),
      api.listChecklistedAuditCatalogEntries(),
      api.listAssignedAuditCatalogEntries(),
      api.listReviewedAuditCatalogEntries(),
      api.listVisibleAuditCatalogEntries(),
      api.listSavedAuditViews(),
      catalogEntryId
        ? api.applyAuditCatalogEntry(catalogEntryId)
        : savedViewId
          ? api.applySavedAuditView(savedViewId)
          : api.getAuditNavigation({
              drilldown: drilldownFilters,
              summary: auditFilters,
            }),
      catalogEntryId
        ? api.getAuditCatalogVisibility(catalogEntryId)
        : Promise.resolve(undefined),
      catalogEntryId
        ? api
            .getAuditCatalogChecklistItemBlocker(catalogEntryId)
            .catch(() => undefined)
        : Promise.resolve(undefined),
      catalogEntryId
        ? api
            .getAuditCatalogChecklistItemResolution(catalogEntryId)
            .catch(() => undefined)
        : Promise.resolve(undefined),
      catalogEntryId
        ? api
            .getAuditCatalogChecklistItemEvidence(catalogEntryId)
            .catch(() => undefined)
        : Promise.resolve(undefined),
      catalogEntryId
        ? api
            .getAuditCatalogChecklistItemVerification(catalogEntryId)
            .catch(() => undefined)
        : Promise.resolve(undefined),
      catalogEntryId
        ? api
            .getAuditCatalogChecklistItemProgress(catalogEntryId)
            .catch(() => undefined)
        : Promise.resolve(undefined),
      catalogEntryId
        ? api
            .getAuditCatalogAssignmentChecklist(catalogEntryId)
            .catch(() => undefined)
        : Promise.resolve(undefined),
      catalogEntryId
        ? api.getAuditCatalogReviewSignal(catalogEntryId).catch(() => undefined)
        : Promise.resolve(undefined),
      catalogEntryId
        ? api
            .getAuditCatalogReviewAssignment(catalogEntryId)
            .catch(() => undefined)
        : Promise.resolve(undefined),
    ]);
    const sortedRuns = [...runs].sort(compareRunsByUpdatedAt);
    let navigation: ApiAuditNavigationView;
    let activeCatalogAssignmentChecklist:
      | ApiAuditCatalogAssignmentChecklistView
      | undefined;
    let activeCatalogChecklistItemBlocker:
      | ApiAuditCatalogChecklistItemBlockerView
      | undefined;
    let activeCatalogChecklistItemResolution:
      | ApiAuditCatalogChecklistItemResolutionView
      | undefined;
    let activeCatalogChecklistItemEvidence:
      | ApiAuditCatalogChecklistItemEvidenceView
      | undefined;
    let activeCatalogChecklistItemVerification:
      | ApiAuditCatalogChecklistItemVerificationView
      | undefined;
    let activeCatalogChecklistItemProgress:
      | ApiAuditCatalogChecklistItemProgressView
      | undefined;
    let activeCatalogReviewAssignment:
      | ApiAuditCatalogReviewAssignmentView
      | undefined;
    let activeCatalogEntry: ApiAuditCatalogVisibilityView | undefined;
    let activeCatalogReviewSignal: ApiAuditCatalogReviewSignalView | undefined;
    let activeSavedView: ApiAuditSavedView | undefined;

    if (hasCatalogEntryApplication(navigationResult)) {
      activeCatalogEntry = catalogVisibility;
      activeCatalogChecklistItemBlocker = catalogChecklistItemBlocker;
      activeCatalogChecklistItemResolution = catalogChecklistItemResolution;
      activeCatalogChecklistItemEvidence = catalogChecklistItemEvidence;
      activeCatalogChecklistItemVerification = catalogChecklistItemVerification;
      activeCatalogChecklistItemProgress = catalogChecklistItemProgress;
      activeCatalogAssignmentChecklist = catalogAssignmentChecklist;
      activeCatalogReviewAssignment = catalogReviewAssignment;
      activeCatalogReviewSignal = catalogReviewSignal;
      activeSavedView = navigationResult.application.savedView;
      navigation = navigationResult.application.navigation;
    } else if (hasSavedViewApplication(navigationResult)) {
      navigation = navigationResult.navigation;
      activeSavedView = navigationResult.savedView;
    } else {
      navigation = navigationResult;
    }

    return (
      <ConsoleShell
        description="Inspect durable workflow runs without leaving the operator surface that already exists in the API."
        title="Runs"
      >
        <FlashBanner message={flash} />
        <ChecklistItemBlockersView
          blockedEntries={blockedEntries}
          {...(activeCatalogChecklistItemBlocker
            ? { activeCatalogChecklistItemBlocker }
            : {})}
        />
        <ChecklistItemResolutionsView
          resolvedEntries={resolvedEntries}
          {...(activeCatalogChecklistItemResolution
            ? { activeCatalogChecklistItemResolution }
            : {})}
        />
        <ChecklistItemEvidencesView
          evidencedEntries={evidencedEntries}
          {...(activeCatalogChecklistItemEvidence
            ? { activeCatalogChecklistItemEvidence }
            : {})}
        />
        <ChecklistItemVerificationsView
          verifiedEntries={verifiedEntries}
          {...(activeCatalogChecklistItemVerification
            ? { activeCatalogChecklistItemVerification }
            : {})}
        />
        <ChecklistItemProgressView
          progressedEntries={progressedEntries}
          {...(activeCatalogChecklistItemProgress
            ? { activeCatalogChecklistItemProgress }
            : {})}
        />
        <AssignmentChecklistsView
          checklistedEntries={checklistedEntries}
          {...(activeCatalogAssignmentChecklist
            ? { activeCatalogAssignmentChecklist }
            : {})}
        />
        <CatalogReviewAssignmentsView
          assignedEntries={assignedEntries}
          {...(activeCatalogReviewAssignment
            ? { activeCatalogReviewAssignment }
            : {})}
        />
        <CatalogReviewSignalsView
          reviewedEntries={reviewedEntries}
          {...(activeCatalogReviewSignal ? { activeCatalogReviewSignal } : {})}
        />
        <AuditViewCatalogsView
          assignedEntries={assignedEntries}
          blockedEntries={blockedEntries}
          catalogEntries={catalogEntries}
          checklistedEntries={checklistedEntries}
          progressedEntries={progressedEntries}
          resolvedEntries={resolvedEntries}
          verifiedEntries={verifiedEntries}
          reviewedEntries={reviewedEntries}
          {...(activeCatalogEntry ? { activeCatalogEntry } : {})}
          {...(activeCatalogChecklistItemBlocker
            ? { activeCatalogChecklistItemBlocker }
            : {})}
          {...(activeCatalogChecklistItemResolution
            ? { activeCatalogChecklistItemResolution }
            : {})}
          {...(activeCatalogChecklistItemEvidence
            ? { activeCatalogChecklistItemEvidence }
            : {})}
          {...(activeCatalogChecklistItemVerification
            ? { activeCatalogChecklistItemVerification }
            : {})}
          {...(activeCatalogChecklistItemProgress
            ? { activeCatalogChecklistItemProgress }
            : {})}
        />
        <SavedAuditViewsView
          navigation={navigation}
          savedViews={savedViews}
          {...(activeSavedView ? { activeSavedView } : {})}
        />
        <CrossRunAuditNavigationView navigation={navigation} />
        <RunsListView runs={sortedRuns} />
      </ConsoleShell>
    );
  } catch (error) {
    return (
      <ConsoleShell
        description="Inspect durable workflow runs without leaving the operator surface that already exists in the API."
        title="Runs"
      >
        <FlashBanner message={flash} />
        <ErrorState
          message={toPageErrorMessage(error)}
          title="Unable to load runs"
        />
      </ConsoleShell>
    );
  }
}

function compareRunsByUpdatedAt(left: ApiRun, right: ApiRun): number {
  return right.updatedAt.localeCompare(left.updatedAt);
}

function hasSavedViewApplication(
  value:
    | ApiAuditNavigationView
    | ApiAuditCatalogEntryApplication
    | ApiAuditSavedViewApplication,
): value is ApiAuditSavedViewApplication {
  return "savedView" in value;
}

function hasCatalogEntryApplication(
  value:
    | ApiAuditNavigationView
    | ApiAuditCatalogEntryApplication
    | ApiAuditSavedViewApplication,
): value is ApiAuditCatalogEntryApplication {
  return "catalogEntry" in value;
}

function readAuditFilters(
  searchParams: PageSearchParams,
): ApiAuditNavigationFilters["summary"] {
  const definitionId = readFirstSearchParam(searchParams.auditDefinitionId);
  const runStatus = readFirstSearchParam(searchParams.auditStatus);
  const executionMode = readFirstSearchParam(searchParams.auditExecutionMode);
  const toolName = readFirstSearchParam(searchParams.auditToolName);

  return {
    ...(definitionId ? { definitionId } : {}),
    ...(runStatus ? { runStatus } : {}),
    ...(executionMode === "inline" || executionMode === "queued"
      ? { executionMode }
      : {}),
    ...(toolName ? { toolName } : {}),
  };
}

function readAuditDrilldownFilters(
  searchParams: PageSearchParams,
): ApiAuditNavigationFilters["drilldown"] {
  const approvalId = readFirstSearchParam(searchParams.drilldownApprovalId);
  const dispatchJobId = readFirstSearchParam(
    searchParams.drilldownDispatchJobId,
  );
  const runId = readFirstSearchParam(searchParams.drilldownRunId);
  const stepId = readFirstSearchParam(searchParams.drilldownStepId);
  const toolCallId = readFirstSearchParam(searchParams.drilldownToolCallId);
  const toolId = readFirstSearchParam(searchParams.drilldownToolId);
  const workerId = readFirstSearchParam(searchParams.drilldownWorkerId);

  return {
    ...(approvalId ? { approvalId } : {}),
    ...(dispatchJobId ? { dispatchJobId } : {}),
    ...(runId ? { runId } : {}),
    ...(stepId ? { stepId } : {}),
    ...(toolCallId ? { toolCallId } : {}),
    ...(toolId ? { toolId } : {}),
    ...(workerId ? { workerId } : {}),
  };
}

function toPageErrorMessage(error: unknown): string {
  if (error instanceof RunrootApiError) {
    return `The API returned ${error.statusCode} while loading ${error.path}.`;
  }

  return error instanceof Error ? error.message : String(error);
}

function readFirstSearchParam(
  value: string | readonly string[] | undefined,
): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  return value?.[0];
}
