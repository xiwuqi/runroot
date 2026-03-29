import {
  ConsoleShell,
  CrossRunAuditResultsView,
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
  type ApiCrossRunAuditFilters,
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
    const auditResults = await api.listAuditResults(auditFilters);

    return (
      <ConsoleShell
        description="Inspect durable workflow runs without leaving the operator surface that already exists in the API."
        title="Runs"
      >
        <FlashBanner message={flash} />
        <CrossRunAuditResultsView
          filters={auditFilters}
          results={auditResults}
        />
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
): ApiCrossRunAuditFilters {
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
