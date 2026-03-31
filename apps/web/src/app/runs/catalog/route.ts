import { appendFlashMessage, buildRedirectUrl } from "../../../lib/navigation";
import {
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
  const intent = readTrimmedFormValue(formData, "intent");

  try {
    if (intent === "archive") {
      const catalogEntryId = readTrimmedFormValue(formData, "catalogEntryId");

      if (!catalogEntryId) {
        appendFlashMessage(
          redirectUrl,
          "error",
          "A catalog entry id is required to archive a catalog entry.",
        );

        return Response.redirect(redirectUrl, 303);
      }

      const catalogEntry =
        await createRunrootApiClient().archiveAuditCatalogEntry(catalogEntryId);

      redirectUrl.searchParams.delete("catalogEntryId");
      appendFlashMessage(
        redirectUrl,
        "notice",
        `Catalog entry ${catalogEntry.entry.name} archived.`,
      );

      return Response.redirect(redirectUrl, 303);
    }

    if (intent === "share" || intent === "unshare") {
      const catalogEntryId = readTrimmedFormValue(formData, "catalogEntryId");

      if (!catalogEntryId) {
        appendFlashMessage(
          redirectUrl,
          "error",
          "A catalog entry id is required to update visibility.",
        );

        return Response.redirect(redirectUrl, 303);
      }

      const visibility =
        intent === "share"
          ? await createRunrootApiClient().shareAuditCatalogEntry(
              catalogEntryId,
            )
          : await createRunrootApiClient().unshareAuditCatalogEntry(
              catalogEntryId,
            );

      appendFlashMessage(
        redirectUrl,
        "notice",
        intent === "share"
          ? `Catalog entry ${visibility.catalogEntry.entry.name} is now shared within ${visibility.visibility.scopeId}.`
          : `Catalog entry ${visibility.catalogEntry.entry.name} is now personal to ${visibility.visibility.ownerId}.`,
      );

      return Response.redirect(redirectUrl, 303);
    }

    if (intent === "review") {
      const catalogEntryId = readTrimmedFormValue(formData, "catalogEntryId");
      const reviewState = readTrimmedFormValue(formData, "reviewState");
      const noteValue = formData.get("note");

      if (!catalogEntryId) {
        appendFlashMessage(
          redirectUrl,
          "error",
          "A catalog entry id is required to update review metadata.",
        );

        return Response.redirect(redirectUrl, 303);
      }

      if (!reviewState) {
        appendFlashMessage(
          redirectUrl,
          "error",
          "A review state is required to update review metadata.",
        );

        return Response.redirect(redirectUrl, 303);
      }

      if (reviewState !== "recommended" && reviewState !== "reviewed") {
        appendFlashMessage(
          redirectUrl,
          "error",
          "Review state must be recommended or reviewed.",
        );

        return Response.redirect(redirectUrl, 303);
      }

      const review = await createRunrootApiClient().reviewAuditCatalogEntry(
        catalogEntryId,
        {
          ...(typeof noteValue === "string" ? { note: noteValue } : {}),
          state: reviewState,
        },
      );

      appendFlashMessage(
        redirectUrl,
        "notice",
        `Review signal for ${review.visibility.catalogEntry.entry.name} updated to ${review.review.state}.`,
      );

      return Response.redirect(redirectUrl, 303);
    }

    if (intent === "assign") {
      const catalogEntryId = readTrimmedFormValue(formData, "catalogEntryId");
      const assigneeId = readTrimmedFormValue(formData, "assigneeId");
      const handoffNoteValue = formData.get("handoffNote");

      if (!catalogEntryId) {
        appendFlashMessage(
          redirectUrl,
          "error",
          "A catalog entry id is required to update assignment metadata.",
        );

        return Response.redirect(redirectUrl, 303);
      }

      if (!assigneeId) {
        appendFlashMessage(
          redirectUrl,
          "error",
          "An assignee id is required to update assignment metadata.",
        );

        return Response.redirect(redirectUrl, 303);
      }

      const assignment = await createRunrootApiClient().assignAuditCatalogEntry(
        catalogEntryId,
        {
          assigneeId,
          ...(typeof handoffNoteValue === "string"
            ? { handoffNote: handoffNoteValue }
            : {}),
        },
      );

      appendFlashMessage(
        redirectUrl,
        "notice",
        `Assignment for ${assignment.review.visibility.catalogEntry.entry.name} updated to ${assignment.assignment.assigneeId}.`,
      );

      return Response.redirect(redirectUrl, 303);
    }

    if (intent === "clear-review") {
      const catalogEntryId = readTrimmedFormValue(formData, "catalogEntryId");

      if (!catalogEntryId) {
        appendFlashMessage(
          redirectUrl,
          "error",
          "A catalog entry id is required to clear review metadata.",
        );

        return Response.redirect(redirectUrl, 303);
      }

      const review =
        await createRunrootApiClient().clearAuditCatalogReviewSignal(
          catalogEntryId,
        );

      appendFlashMessage(
        redirectUrl,
        "notice",
        `Review signal for ${review.visibility.catalogEntry.entry.name} cleared.`,
      );

      return Response.redirect(redirectUrl, 303);
    }

    if (intent === "clear-assignment") {
      const catalogEntryId = readTrimmedFormValue(formData, "catalogEntryId");

      if (!catalogEntryId) {
        appendFlashMessage(
          redirectUrl,
          "error",
          "A catalog entry id is required to clear assignment metadata.",
        );

        return Response.redirect(redirectUrl, 303);
      }

      const assignment =
        await createRunrootApiClient().clearAuditCatalogReviewAssignment(
          catalogEntryId,
        );

      appendFlashMessage(
        redirectUrl,
        "notice",
        `Assignment for ${assignment.review.visibility.catalogEntry.entry.name} cleared.`,
      );

      return Response.redirect(redirectUrl, 303);
    }

    const savedViewId = readTrimmedFormValue(formData, "savedViewId");

    if (!savedViewId) {
      appendFlashMessage(
        redirectUrl,
        "error",
        "A saved-view id is required to publish a catalog entry.",
      );

      return Response.redirect(redirectUrl, 303);
    }

    const catalogEntry =
      await createRunrootApiClient().publishAuditCatalogEntry({
        savedViewId,
      });
    const successUrl = new URL(
      `/runs?catalogEntryId=${catalogEntry.entry.id}`,
      request.url,
    );

    appendFlashMessage(
      successUrl,
      "notice",
      `Catalog entry ${catalogEntry.entry.name} published.`,
    );

    return Response.redirect(successUrl, 303);
  } catch (error) {
    appendFlashMessage(
      redirectUrl,
      "error",
      error instanceof RunrootApiError
        ? `Catalog update failed with ${error.statusCode}.`
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
