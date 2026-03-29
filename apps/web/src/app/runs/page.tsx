import {
  ConsoleShell,
  CrossRunAuditNavigationView,
  ErrorState,
  FlashBanner,
  RunsListView,
} from "../../components/console";
import {
  getFlashMessage,
  type PageSearchParams,
  resolvePageSearchParams,
} from "../../lib/navigation";
import {
  type ApiAuditNavigationFilters,
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
    const runs = [...(await api.listRuns())].sort(compareRunsByUpdatedAt);
    const auditFilters = readAuditFilters(resolvedSearchParams);
    const drilldownFilters = readAuditDrilldownFilters(resolvedSearchParams);
    const navigation = await api.getAuditNavigation({
      drilldown: drilldownFilters,
      summary: auditFilters,
    });

    return (
      <ConsoleShell
        description="Inspect durable workflow runs without leaving the operator surface that already exists in the API."
        title="Runs"
      >
        <FlashBanner message={flash} />
        <CrossRunAuditNavigationView navigation={navigation} />
        <RunsListView runs={runs} />
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
