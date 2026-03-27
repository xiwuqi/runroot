import {
  appendFlashMessage,
  buildRedirectUrl,
} from "../../../../lib/navigation";
import {
  createRunrootApiClient,
  RunrootApiError,
} from "../../../../lib/runroot-api";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      runId: string;
    }>;
  },
) {
  const { runId } = await context.params;
  const formData = await request.formData();
  const redirectUrl = buildRedirectUrl(
    request.url,
    formData.get("returnTo"),
    `/runs/${runId}`,
  );

  try {
    await createRunrootApiClient().resumeRun(runId);
    appendFlashMessage(redirectUrl, "notice", `Run ${runId} resumed.`);
  } catch (error) {
    appendFlashMessage(
      redirectUrl,
      "error",
      error instanceof RunrootApiError
        ? `Run resume failed with ${error.statusCode}.`
        : error instanceof Error
          ? error.message
          : String(error),
    );
  }

  return Response.redirect(redirectUrl, 303);
}
