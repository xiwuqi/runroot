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
