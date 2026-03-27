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
      approvalId: string;
    }>;
  },
) {
  const { approvalId } = await context.params;
  const formData = await request.formData();
  const decision = formData.get("decision");
  const redirectUrl = buildRedirectUrl(
    request.url,
    formData.get("returnTo"),
    "/approvals",
  );

  if (
    decision !== "approved" &&
    decision !== "rejected" &&
    decision !== "cancelled"
  ) {
    appendFlashMessage(redirectUrl, "error", "A valid decision is required.");
    return Response.redirect(redirectUrl, 303);
  }

  try {
    await createRunrootApiClient().decideApproval(approvalId, {
      ...(typeof formData.get("actorDisplayName") === "string"
        ? {
            actorDisplayName: formData.get("actorDisplayName") as string,
          }
        : {}),
      ...(typeof formData.get("actorId") === "string"
        ? {
            actorId: formData.get("actorId") as string,
          }
        : {}),
      decision,
      ...(typeof formData.get("note") === "string" &&
      (formData.get("note") as string).trim()
        ? {
            note: (formData.get("note") as string).trim(),
          }
        : {}),
    });

    appendFlashMessage(
      redirectUrl,
      "notice",
      `Approval ${approvalId} marked as ${decision}.`,
    );
  } catch (error) {
    appendFlashMessage(
      redirectUrl,
      "error",
      error instanceof RunrootApiError
        ? `Approval update failed with ${error.statusCode}.`
        : error instanceof Error
          ? error.message
          : String(error),
    );
  }

  return Response.redirect(redirectUrl, 303);
}
