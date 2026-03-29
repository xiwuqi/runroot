import { appendFlashMessage, buildRedirectUrl } from "../../../lib/navigation";
import {
  type ApiAuditNavigationFilters,
  createRunrootApiClient,
  RunrootApiError,
} from "../../../lib/runroot-api";

export async function POST(request: Request) {
  const formData = await request.formData();
  const redirectUrl = buildRedirectUrl(
    request.url,
    formData.get("returnTo"),
    "/runs",
  );
  const name = readTrimmedFormValue(formData, "name");

  if (!name) {
    appendFlashMessage(redirectUrl, "error", "A saved-view name is required.");

    return Response.redirect(redirectUrl, 303);
  }

  try {
    const description = readTrimmedFormValue(formData, "description");
    const navigation = readSavedViewNavigationFromForm(formData);
    const savedView = await createRunrootApiClient().saveSavedAuditView({
      ...(description ? { description } : {}),
      name,
      navigation,
    });
    const successUrl = new URL(
      `/runs?savedViewId=${savedView.id}`,
      request.url,
    );

    appendFlashMessage(
      successUrl,
      "notice",
      `Saved audit view ${savedView.name} created.`,
    );

    return Response.redirect(successUrl, 303);
  } catch (error) {
    appendFlashMessage(
      redirectUrl,
      "error",
      error instanceof RunrootApiError
        ? `Saved-view save failed with ${error.statusCode}.`
        : error instanceof Error
          ? error.message
          : String(error),
    );

    return Response.redirect(redirectUrl, 303);
  }
}

function readTrimmedFormValue(
  formData: FormData,
  key: string,
): string | undefined {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function readSavedViewNavigationFromForm(
  formData: FormData,
): Partial<ApiAuditNavigationFilters> {
  const summaryDefinitionId = readTrimmedFormValue(
    formData,
    "summaryDefinitionId",
  );
  const summaryExecutionMode = readTrimmedFormValue(
    formData,
    "summaryExecutionMode",
  );
  const summaryRunStatus = readTrimmedFormValue(formData, "summaryRunStatus");
  const summaryToolName = readTrimmedFormValue(formData, "summaryToolName");
  const drilldownApprovalId = readTrimmedFormValue(
    formData,
    "drilldownApprovalId",
  );
  const drilldownDispatchJobId = readTrimmedFormValue(
    formData,
    "drilldownDispatchJobId",
  );
  const drilldownRunId = readTrimmedFormValue(formData, "drilldownRunId");
  const drilldownStepId = readTrimmedFormValue(formData, "drilldownStepId");
  const drilldownToolCallId = readTrimmedFormValue(
    formData,
    "drilldownToolCallId",
  );
  const drilldownToolId = readTrimmedFormValue(formData, "drilldownToolId");
  const drilldownWorkerId = readTrimmedFormValue(formData, "drilldownWorkerId");

  return {
    drilldown: {
      ...(drilldownApprovalId ? { approvalId: drilldownApprovalId } : {}),
      ...(drilldownDispatchJobId
        ? { dispatchJobId: drilldownDispatchJobId }
        : {}),
      ...(drilldownRunId ? { runId: drilldownRunId } : {}),
      ...(drilldownStepId ? { stepId: drilldownStepId } : {}),
      ...(drilldownToolCallId ? { toolCallId: drilldownToolCallId } : {}),
      ...(drilldownToolId ? { toolId: drilldownToolId } : {}),
      ...(drilldownWorkerId ? { workerId: drilldownWorkerId } : {}),
    },
    summary: {
      ...(summaryDefinitionId ? { definitionId: summaryDefinitionId } : {}),
      ...(summaryExecutionMode === "inline" || summaryExecutionMode === "queued"
        ? { executionMode: summaryExecutionMode }
        : {}),
      ...(summaryRunStatus ? { runStatus: summaryRunStatus } : {}),
      ...(summaryToolName ? { toolName: summaryToolName } : {}),
    },
  };
}
