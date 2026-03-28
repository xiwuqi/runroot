import {
  ConsoleShell,
  ErrorState,
  FlashBanner,
  RunDetailView,
} from "../../../components/console";
import {
  getFlashMessage,
  type PageSearchParams,
  resolvePageSearchParams,
} from "../../../lib/navigation";
import {
  createRunrootApiClient,
  RunrootApiError,
} from "../../../lib/runroot-api";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{
    runId: string;
  }>;
  searchParams?: Promise<PageSearchParams>;
}>) {
  const { runId } = await params;
  const flash = getFlashMessage(await resolvePageSearchParams(searchParams));
  const api = createRunrootApiClient();

  try {
    const [run, approvals, toolHistory, timeline] = await Promise.all([
      api.getRun(runId),
      api.getApprovals(runId),
      api.getToolHistory(runId),
      api.getTimeline(runId),
    ]);

    return (
      <ConsoleShell
        actions={
          <a className="link-button" href={`/runs/${runId}/timeline`}>
            Open timeline
          </a>
        }
        description="View the current run state, approval snapshots, and recent replay facts."
        title="Run detail"
      >
        <FlashBanner message={flash} />
        <RunDetailView
          approvals={approvals}
          run={run}
          toolHistory={toolHistory}
          timeline={timeline}
        />
      </ConsoleShell>
    );
  } catch (error) {
    return (
      <ConsoleShell
        description="View the current run state, approval snapshots, and recent replay facts."
        title="Run detail"
      >
        <FlashBanner message={flash} />
        <ErrorState
          message={toPageErrorMessage(error)}
          title={`Unable to load run ${runId}`}
        />
      </ConsoleShell>
    );
  }
}

function toPageErrorMessage(error: unknown): string {
  if (error instanceof RunrootApiError) {
    return `The API returned ${error.statusCode} while loading ${error.path}.`;
  }

  return error instanceof Error ? error.message : String(error);
}
