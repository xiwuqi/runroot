import {
  ApprovalQueueView,
  ConsoleShell,
  ErrorState,
  FlashBanner,
} from "../../components/console";
import {
  getFlashMessage,
  type PageSearchParams,
  resolvePageSearchParams,
} from "../../lib/navigation";
import { createRunrootApiClient, RunrootApiError } from "../../lib/runroot-api";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<PageSearchParams>;
}>) {
  const flash = getFlashMessage(await resolvePageSearchParams(searchParams));
  const api = createRunrootApiClient();

  try {
    const approvals = await api.getPendingApprovals();

    return (
      <ConsoleShell
        description="Pending approvals remain package-driven operator actions. The console only visualizes and triggers them."
        title="Approval queue"
      >
        <FlashBanner message={flash} />
        <ApprovalQueueView items={approvals} />
      </ConsoleShell>
    );
  } catch (error) {
    return (
      <ConsoleShell
        description="Pending approvals remain package-driven operator actions. The console only visualizes and triggers them."
        title="Approval queue"
      >
        <FlashBanner message={flash} />
        <ErrorState
          message={toPageErrorMessage(error)}
          title="Unable to load pending approvals"
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
