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

    if (intent === "checklist") {
      const catalogEntryId = readTrimmedFormValue(formData, "catalogEntryId");
      const checklistState = readTrimmedFormValue(formData, "checklistState");
      const checklistItems = readChecklistItems(formData.get("checklistItems"));

      if (!catalogEntryId) {
        appendFlashMessage(
          redirectUrl,
          "error",
          "A catalog entry id is required to update checklist metadata.",
        );

        return Response.redirect(redirectUrl, 303);
      }

      if (!checklistState) {
        appendFlashMessage(
          redirectUrl,
          "error",
          "A checklist state is required to update checklist metadata.",
        );

        return Response.redirect(redirectUrl, 303);
      }

      if (checklistState !== "pending" && checklistState !== "completed") {
        appendFlashMessage(
          redirectUrl,
          "error",
          "Checklist state must be pending or completed.",
        );

        return Response.redirect(redirectUrl, 303);
      }

      const checklist =
        await createRunrootApiClient().setAuditCatalogAssignmentChecklist(
          catalogEntryId,
          {
            ...(checklistItems.length > 0 ? { items: checklistItems } : {}),
            state: checklistState,
          },
        );

      appendFlashMessage(
        redirectUrl,
        "notice",
        `Checklist for ${checklist.assignment.review.visibility.catalogEntry.entry.name} updated to ${checklist.checklist.state}.`,
      );

      return Response.redirect(redirectUrl, 303);
    }

    if (intent === "progress") {
      const catalogEntryId = readTrimmedFormValue(formData, "catalogEntryId");
      const progressItems = readChecklistItemProgressItems(
        formData.get("progressItems"),
      );
      const completionNoteValue = formData.get("completionNote");

      if (!catalogEntryId) {
        appendFlashMessage(
          redirectUrl,
          "error",
          "A catalog entry id is required to update checklist item progress metadata.",
        );

        return Response.redirect(redirectUrl, 303);
      }

      if (progressItems.length === 0) {
        appendFlashMessage(
          redirectUrl,
          "error",
          "At least one checklist item progress entry is required.",
        );

        return Response.redirect(redirectUrl, 303);
      }

      const progress =
        await createRunrootApiClient().setAuditCatalogChecklistItemProgress(
          catalogEntryId,
          {
            ...(typeof completionNoteValue === "string"
              ? { completionNote: completionNoteValue }
              : {}),
            items: progressItems,
          },
        );

      appendFlashMessage(
        redirectUrl,
        "notice",
        `Checklist item progress for ${progress.checklist.assignment.review.visibility.catalogEntry.entry.name} updated.`,
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

    if (intent === "clear-checklist") {
      const catalogEntryId = readTrimmedFormValue(formData, "catalogEntryId");

      if (!catalogEntryId) {
        appendFlashMessage(
          redirectUrl,
          "error",
          "A catalog entry id is required to clear checklist metadata.",
        );

        return Response.redirect(redirectUrl, 303);
      }

      const checklist =
        await createRunrootApiClient().clearAuditCatalogAssignmentChecklist(
          catalogEntryId,
        );

      appendFlashMessage(
        redirectUrl,
        "notice",
        `Checklist for ${checklist.assignment.review.visibility.catalogEntry.entry.name} cleared.`,
      );

      return Response.redirect(redirectUrl, 303);
    }

    if (intent === "clear-progress") {
      const catalogEntryId = readTrimmedFormValue(formData, "catalogEntryId");

      if (!catalogEntryId) {
        appendFlashMessage(
          redirectUrl,
          "error",
          "A catalog entry id is required to clear checklist item progress metadata.",
        );

        return Response.redirect(redirectUrl, 303);
      }

      const progress =
        await createRunrootApiClient().clearAuditCatalogChecklistItemProgress(
          catalogEntryId,
        );

      appendFlashMessage(
        redirectUrl,
        "notice",
        `Checklist item progress for ${progress.checklist.assignment.review.visibility.catalogEntry.entry.name} cleared.`,
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

function readChecklistItems(
  value: FormDataEntryValue | null,
): readonly string[] {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function readChecklistItemProgressItems(
  value: FormDataEntryValue | null,
): readonly {
  readonly item: string;
  readonly state: "completed" | "pending";
}[] {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const separatorIndex = line.indexOf(":");

      if (separatorIndex < 0) {
        return {
          item: line,
          state: "pending" as const,
        };
      }

      const rawState = line.slice(0, separatorIndex).trim();
      const item = line.slice(separatorIndex + 1).trim();

      if (item.length === 0) {
        throw new Error(
          "Checklist item progress lines require a non-empty item.",
        );
      }

      if (rawState !== "completed" && rawState !== "pending") {
        throw new Error(
          `Checklist item progress state must be pending or completed for "${item}".`,
        );
      }

      return {
        item,
        state: rawState,
      };
    });
}
