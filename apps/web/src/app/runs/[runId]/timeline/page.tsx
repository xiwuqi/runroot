import {
  ConsoleShell,
  ErrorState,
  FlashBanner,
  TimelineView,
} from "../../../../components/console";
import {
  getFlashMessage,
  type PageSearchParams,
  resolvePageSearchParams,
} from "../../../../lib/navigation";
import {
  createRunrootApiClient,
  RunrootApiError,
} from "../../../../lib/runroot-api";

export const dynamic = "force-dynamic";

export default async function RunTimelinePage({
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
    const timeline = await api.getTimeline(runId);

    return (
      <ConsoleShell
        actions={
          <a className="link-button" href={`/runs/${runId}`}>
            Back to run detail
          </a>
        }
        description="Replay is still derived from persisted runtime and approval events. Tool hooks remain separate."
        title="Run timeline"
      >
        <FlashBanner message={flash} />
        <TimelineView runId={runId} timeline={timeline} />
      </ConsoleShell>
    );
  } catch (error) {
    return (
      <ConsoleShell
        description="Replay is still derived from persisted runtime and approval events. Tool hooks remain separate."
        title="Run timeline"
      >
        <FlashBanner message={flash} />
        <ErrorState
          message={toPageErrorMessage(error)}
          title={`Unable to load timeline for ${runId}`}
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
