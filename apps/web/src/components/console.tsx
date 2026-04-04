import type { ReactNode } from "react";
import type { FlashMessage } from "../lib/navigation";
import type {
  ApiApproval,
  ApiAuditCatalogAssignmentChecklistCollection,
  ApiAuditCatalogAssignmentChecklistView,
  ApiAuditCatalogChecklistItemAcknowledgmentCollection,
  ApiAuditCatalogChecklistItemAcknowledgmentItem,
  ApiAuditCatalogChecklistItemAcknowledgmentView,
  ApiAuditCatalogChecklistItemAttestationCollection,
  ApiAuditCatalogChecklistItemAttestationItem,
  ApiAuditCatalogChecklistItemAttestationView,
  ApiAuditCatalogChecklistItemBlockerCollection,
  ApiAuditCatalogChecklistItemBlockerItem,
  ApiAuditCatalogChecklistItemBlockerView,
  ApiAuditCatalogChecklistItemEvidenceCollection,
  ApiAuditCatalogChecklistItemEvidenceItem,
  ApiAuditCatalogChecklistItemEvidenceView,
  ApiAuditCatalogChecklistItemExceptionCollection,
  ApiAuditCatalogChecklistItemExceptionItem,
  ApiAuditCatalogChecklistItemExceptionView,
  ApiAuditCatalogChecklistItemProgressCollection,
  ApiAuditCatalogChecklistItemProgressItem,
  ApiAuditCatalogChecklistItemProgressView,
  ApiAuditCatalogChecklistItemResolutionCollection,
  ApiAuditCatalogChecklistItemResolutionItem,
  ApiAuditCatalogChecklistItemResolutionView,
  ApiAuditCatalogChecklistItemSignoffCollection,
  ApiAuditCatalogChecklistItemSignoffItem,
  ApiAuditCatalogChecklistItemSignoffView,
  ApiAuditCatalogChecklistItemVerificationCollection,
  ApiAuditCatalogChecklistItemVerificationItem,
  ApiAuditCatalogChecklistItemVerificationView,
  ApiAuditCatalogReviewAssignmentCollection,
  ApiAuditCatalogReviewAssignmentView,
  ApiAuditCatalogReviewSignalCollection,
  ApiAuditCatalogReviewSignalView,
  ApiAuditCatalogVisibilityCollection,
  ApiAuditCatalogVisibilityView,
  ApiAuditDrilldownLink,
  ApiAuditNavigationFilters,
  ApiAuditNavigationView,
  ApiAuditSavedView,
  ApiAuditSavedViewCollection,
  ApiAuditView,
  ApiCrossRunAuditDrilldownFilters,
  ApiCrossRunAuditDrilldownResults,
  ApiCrossRunAuditFilters,
  ApiCrossRunAuditResults,
  ApiRun,
  ApiRunAuditViewLink,
  ApiTimeline,
  ApiToolHistoryEntry,
  PendingApprovalSummary,
} from "../lib/runroot-api";

export function ConsoleShell({
  actions,
  children,
  description,
  title,
}: Readonly<{
  actions?: ReactNode;
  children: ReactNode;
  description: string;
  title: string;
}>) {
  return (
    <main className="console-page">
      <header className="console-hero">
        <div>
          <div className="console-eyebrow">Phase 6 / Web Console</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions ? <div className="console-actions">{actions}</div> : null}
      </header>
      {children}
    </main>
  );
}

export function TopNavigation() {
  return (
    <nav aria-label="Primary" className="top-nav">
      <a className="brand" href="/runs">
        Runroot Console
      </a>
      <div className="top-nav-links">
        <a href="/runs">Runs</a>
        <a href="/approvals">Approvals</a>
      </div>
    </nav>
  );
}

export function FlashBanner({
  message,
}: Readonly<{
  message: FlashMessage | undefined;
}>) {
  if (!message) {
    return null;
  }

  return (
    <section
      className={`flash-banner ${message.tone === "error" ? "error" : "notice"}`}
    >
      {message.text}
    </section>
  );
}

export function RunsListView({
  runs,
}: Readonly<{
  runs: readonly ApiRun[];
}>) {
  if (runs.length === 0) {
    return (
      <section className="card empty-state">
        <h2>No runs yet</h2>
        <p>
          Start a workflow through the CLI or API first. The web console only
          visualizes existing runs.
        </p>
      </section>
    );
  }

  return (
    <section className="list-grid">
      {runs.map((run) => (
        <article className="card run-card" key={run.id}>
          <div className="row spread">
            <div>
              <div className="card-eyebrow">{run.definitionId}</div>
              <h2>{run.definitionName}</h2>
            </div>
            <StatusBadge status={run.status} />
          </div>
          <dl className="data-grid">
            <MetadataRow label="Run ID" value={run.id} />
            <MetadataRow
              label="Created"
              value={formatTimestamp(run.createdAt)}
            />
            <MetadataRow
              label="Updated"
              value={formatTimestamp(run.updatedAt)}
            />
            <MetadataRow
              label="Template"
              value={run.metadata.templateId ?? run.definitionId}
            />
          </dl>
          <div className="row spread">
            <a className="link-button" href={`/runs/${run.id}`}>
              Open run detail
            </a>
            <a className="subtle-link" href={`/runs/${run.id}/timeline`}>
              View timeline
            </a>
          </div>
        </article>
      ))}
    </section>
  );
}

export function AssignmentChecklistsView({
  activeCatalogAssignmentChecklist,
  checklistedEntries,
}: Readonly<{
  activeCatalogAssignmentChecklist?: ApiAuditCatalogAssignmentChecklistView;
  checklistedEntries: ApiAuditCatalogAssignmentChecklistCollection;
}>) {
  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">Phase 20 / Assignment Checklists</div>
          <h2>Assignment checklists</h2>
          <p className="empty-copy">
            Track thin checklist items and handoff status on assigned reviewed
            presets without turning the console into a workflow engine or
            collaboration product.
          </p>
        </div>
        <div className="timeline-count">
          {checklistedEntries.totalCount} checklisted preset(s)
        </div>
      </div>

      {activeCatalogAssignmentChecklist ? (
        <div className="inline-note">
          Active checklist:{" "}
          <strong>
            {
              activeCatalogAssignmentChecklist.assignment.review.visibility
                .catalogEntry.entry.name
            }
          </strong>
          {" · "}status {activeCatalogAssignmentChecklist.checklist.state}
          {activeCatalogAssignmentChecklist.checklist.items?.length
            ? ` · ${activeCatalogAssignmentChecklist.checklist.items.length} item(s)`
            : ""}
        </div>
      ) : null}

      {checklistedEntries.items.length === 0 ? (
        <p className="empty-copy">
          No assignment checklists yet. Assign a reviewed visible preset first,
          then save a thin checklist through the shared operator seam.
        </p>
      ) : (
        <ol className="timeline-list">
          {checklistedEntries.items.map((checklistView) => (
            <li
              className="timeline-entry"
              key={
                checklistView.assignment.review.visibility.catalogEntry.entry.id
              }
            >
              <div className="row spread">
                <div>
                  <strong>
                    {
                      checklistView.assignment.review.visibility.catalogEntry
                        .entry.name
                    }
                  </strong>
                  <div className="timeline-meta">
                    {checklistView.checklist.state} ·{" "}
                    {checklistView.assignment.assignment.state}
                    {" · "}
                    {checklistView.assignment.review.review.state}
                  </div>
                </div>
                <span>
                  {formatTimestamp(checklistView.checklist.updatedAt)}
                </span>
              </div>
              {checklistView.checklist.items?.length ? (
                <ul className="approval-history">
                  {checklistView.checklist.items.map((item) => (
                    <li
                      key={`${checklistView.checklist.catalogEntryId}:${item}`}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-copy">
                  No checklist items stored. Only the handoff status is present.
                </p>
              )}
              <div className="timeline-meta">
                operator {checklistView.checklist.operatorId} · scope{" "}
                {checklistView.checklist.scopeId}
              </div>
              <div className="row spread">
                <a
                  className="link-button"
                  href={buildCatalogEntryHref(
                    checklistView.assignment.review.visibility.catalogEntry
                      .entry.id,
                  )}
                >
                  Apply checklisted preset
                </a>
                <form
                  action="/runs/catalog"
                  className="action-form"
                  method="post"
                >
                  <input
                    name="returnTo"
                    type="hidden"
                    value={buildCatalogEntryHref(
                      checklistView.assignment.review.visibility.catalogEntry
                        .entry.id,
                    )}
                  />
                  <input name="intent" type="hidden" value="clear-checklist" />
                  <input
                    name="catalogEntryId"
                    type="hidden"
                    value={
                      checklistView.assignment.review.visibility.catalogEntry
                        .entry.id
                    }
                  />
                  <button type="submit">Clear checklist</button>
                </form>
              </div>
              {activeCatalogAssignmentChecklist?.assignment.review.visibility
                .catalogEntry.entry.id ===
              checklistView.assignment.review.visibility.catalogEntry.entry
                .id ? (
                <div className="timeline-meta">Currently applied</div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ChecklistItemProgressView({
  activeCatalogChecklistItemProgress,
  progressedEntries,
}: Readonly<{
  activeCatalogChecklistItemProgress?: ApiAuditCatalogChecklistItemProgressView;
  progressedEntries: ApiAuditCatalogChecklistItemProgressCollection;
}>) {
  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">Phase 21 / Checklist Item Progress</div>
          <h2>Checklist item progress</h2>
          <p className="empty-copy">
            Track thin per-item checklist progress and a single completion note
            on assigned reviewed presets without turning the console into a
            broader workflow engine or collaboration product.
          </p>
        </div>
        <div className="timeline-count">
          {progressedEntries.totalCount} progressed preset(s)
        </div>
      </div>

      {activeCatalogChecklistItemProgress ? (
        <div className="inline-note">
          Active progress:{" "}
          <strong>
            {
              activeCatalogChecklistItemProgress.checklist.assignment.review
                .visibility.catalogEntry.entry.name
            }
          </strong>
          {" · "}
          {formatProgressSummary(
            activeCatalogChecklistItemProgress.progress.items,
          )}
          {activeCatalogChecklistItemProgress.progress.completionNote
            ? ` · ${activeCatalogChecklistItemProgress.progress.completionNote}`
            : ""}
        </div>
      ) : null}

      {progressedEntries.items.length === 0 ? (
        <p className="empty-copy">
          No checklist item progress yet. Save an assignment checklist first,
          then record thin per-item progress through the shared operator seam.
        </p>
      ) : (
        <ol className="timeline-list">
          {progressedEntries.items.map((progressView) => (
            <li
              className="timeline-entry"
              key={
                progressView.checklist.assignment.review.visibility.catalogEntry
                  .entry.id
              }
            >
              <div className="row spread">
                <div>
                  <strong>
                    {
                      progressView.checklist.assignment.review.visibility
                        .catalogEntry.entry.name
                    }
                  </strong>
                  <div className="timeline-meta">
                    {formatProgressSummary(progressView.progress.items)}
                    {" · "}
                    {progressView.checklist.checklist.state}
                    {" · "}
                    {progressView.checklist.assignment.assignment.state}
                  </div>
                </div>
                <span>{formatTimestamp(progressView.progress.updatedAt)}</span>
              </div>
              <ul className="approval-history">
                {progressView.progress.items.map((item) => (
                  <li
                    key={`${progressView.progress.catalogEntryId}:${item.item}`}
                  >
                    <strong>{item.state}</strong>: {item.item}
                  </li>
                ))}
              </ul>
              {progressView.progress.completionNote ? (
                <p className="empty-copy">
                  {progressView.progress.completionNote}
                </p>
              ) : null}
              <div className="timeline-meta">
                operator {progressView.progress.operatorId} · scope{" "}
                {progressView.progress.scopeId}
              </div>
              <div className="row spread">
                <a
                  className="link-button"
                  href={buildCatalogEntryHref(
                    progressView.checklist.assignment.review.visibility
                      .catalogEntry.entry.id,
                  )}
                >
                  Apply progressed preset
                </a>
                <form
                  action="/runs/catalog"
                  className="action-form"
                  method="post"
                >
                  <input
                    name="returnTo"
                    type="hidden"
                    value={buildCatalogEntryHref(
                      progressView.checklist.assignment.review.visibility
                        .catalogEntry.entry.id,
                    )}
                  />
                  <input name="intent" type="hidden" value="clear-progress" />
                  <input
                    name="catalogEntryId"
                    type="hidden"
                    value={
                      progressView.checklist.assignment.review.visibility
                        .catalogEntry.entry.id
                    }
                  />
                  <button type="submit">Clear progress</button>
                </form>
              </div>
              {activeCatalogChecklistItemProgress?.checklist.assignment.review
                .visibility.catalogEntry.entry.id ===
              progressView.checklist.assignment.review.visibility.catalogEntry
                .entry.id ? (
                <div className="timeline-meta">Currently applied</div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ChecklistItemBlockersView({
  activeCatalogChecklistItemBlocker,
  blockedEntries,
}: Readonly<{
  activeCatalogChecklistItemBlocker?: ApiAuditCatalogChecklistItemBlockerView;
  blockedEntries: ApiAuditCatalogChecklistItemBlockerCollection;
}>) {
  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">Phase 22 / Checklist Item Blockers</div>
          <h2>Checklist item blockers</h2>
          <p className="empty-copy">
            Track thin per-item blockers and a single blocker note on progressed
            assigned presets without turning the console into a workflow engine
            or collaboration product.
          </p>
        </div>
        <div className="timeline-count">
          {blockedEntries.totalCount} blocked preset(s)
        </div>
      </div>

      {activeCatalogChecklistItemBlocker ? (
        <div className="inline-note">
          Active blockers:{" "}
          <strong>
            {
              activeCatalogChecklistItemBlocker.progress.checklist.assignment
                .review.visibility.catalogEntry.entry.name
            }
          </strong>
          {" · "}
          {formatBlockerSummary(
            activeCatalogChecklistItemBlocker.blocker.items,
          )}
          {activeCatalogChecklistItemBlocker.blocker.blockerNote
            ? ` · ${activeCatalogChecklistItemBlocker.blocker.blockerNote}`
            : ""}
        </div>
      ) : null}

      {blockedEntries.items.length === 0 ? (
        <p className="empty-copy">
          No checklist item blockers yet. Record progress first, then save thin
          blocker metadata through the shared operator seam.
        </p>
      ) : (
        <ol className="timeline-list">
          {blockedEntries.items.map((blockerView) => (
            <li
              className="timeline-entry"
              key={
                blockerView.progress.checklist.assignment.review.visibility
                  .catalogEntry.entry.id
              }
            >
              <div className="row spread">
                <div>
                  <strong>
                    {
                      blockerView.progress.checklist.assignment.review
                        .visibility.catalogEntry.entry.name
                    }
                  </strong>
                  <div className="timeline-meta">
                    {formatBlockerSummary(blockerView.blocker.items)}
                    {" · "}
                    {formatProgressSummary(blockerView.progress.progress.items)}
                    {" · "}
                    {blockerView.progress.checklist.checklist.state}
                  </div>
                </div>
                <span>{formatTimestamp(blockerView.blocker.updatedAt)}</span>
              </div>
              <ul className="approval-history">
                {blockerView.blocker.items.map((item) => (
                  <li
                    key={`${blockerView.blocker.catalogEntryId}:${item.item}`}
                  >
                    <strong>{item.state}</strong>: {item.item}
                  </li>
                ))}
              </ul>
              {blockerView.blocker.blockerNote ? (
                <p className="empty-copy">{blockerView.blocker.blockerNote}</p>
              ) : null}
              <div className="timeline-meta">
                operator {blockerView.blocker.operatorId} · scope{" "}
                {blockerView.blocker.scopeId}
              </div>
              <div className="row spread">
                <a
                  className="link-button"
                  href={buildCatalogEntryHref(
                    blockerView.progress.checklist.assignment.review.visibility
                      .catalogEntry.entry.id,
                  )}
                >
                  Apply blocked preset
                </a>
                <form
                  action="/runs/catalog"
                  className="action-form"
                  method="post"
                >
                  <input
                    name="returnTo"
                    type="hidden"
                    value={buildCatalogEntryHref(
                      blockerView.progress.checklist.assignment.review
                        .visibility.catalogEntry.entry.id,
                    )}
                  />
                  <input name="intent" type="hidden" value="clear-blocker" />
                  <input
                    name="catalogEntryId"
                    type="hidden"
                    value={
                      blockerView.progress.checklist.assignment.review
                        .visibility.catalogEntry.entry.id
                    }
                  />
                  <button type="submit">Clear blockers</button>
                </form>
              </div>
              {activeCatalogChecklistItemBlocker?.progress.checklist.assignment
                .review.visibility.catalogEntry.entry.id ===
              blockerView.progress.checklist.assignment.review.visibility
                .catalogEntry.entry.id ? (
                <div className="timeline-meta">Currently applied</div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ChecklistItemResolutionsView({
  activeCatalogChecklistItemResolution,
  resolvedEntries,
}: Readonly<{
  activeCatalogChecklistItemResolution?: ApiAuditCatalogChecklistItemResolutionView;
  resolvedEntries: ApiAuditCatalogChecklistItemResolutionCollection;
}>) {
  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">
            Phase 23 / Checklist Item Resolutions
          </div>
          <h2>Checklist item resolutions</h2>
          <p className="empty-copy">
            Track thin per-item resolutions and a single resolution note on
            blocked progressed presets without turning the console into a
            workflow engine or collaboration product.
          </p>
        </div>
        <div className="timeline-count">
          {resolvedEntries.totalCount} resolved preset(s)
        </div>
      </div>

      {activeCatalogChecklistItemResolution ? (
        <div className="inline-note">
          Active resolutions:{" "}
          <strong>
            {
              activeCatalogChecklistItemResolution.blocker.progress.checklist
                .assignment.review.visibility.catalogEntry.entry.name
            }
          </strong>
          {" · "}
          {formatResolutionSummary(
            activeCatalogChecklistItemResolution.resolution.items,
          )}
          {activeCatalogChecklistItemResolution.resolution.resolutionNote
            ? ` · ${activeCatalogChecklistItemResolution.resolution.resolutionNote}`
            : ""}
        </div>
      ) : null}

      {resolvedEntries.items.length === 0 ? (
        <p className="empty-copy">
          No checklist item resolutions yet. Record blockers first, then save
          thin resolution metadata through the shared operator seam.
        </p>
      ) : (
        <ol className="timeline-list">
          {resolvedEntries.items.map((resolutionView) => (
            <li
              className="timeline-entry"
              key={
                resolutionView.blocker.progress.checklist.assignment.review
                  .visibility.catalogEntry.entry.id
              }
            >
              <div className="row spread">
                <div>
                  <strong>
                    {
                      resolutionView.blocker.progress.checklist.assignment
                        .review.visibility.catalogEntry.entry.name
                    }
                  </strong>
                  <div className="timeline-meta">
                    {formatResolutionSummary(resolutionView.resolution.items)}
                    {" · "}
                    {formatBlockerSummary(resolutionView.blocker.blocker.items)}
                    {" · "}
                    {formatProgressSummary(
                      resolutionView.blocker.progress.progress.items,
                    )}
                  </div>
                </div>
                <span>
                  {formatTimestamp(resolutionView.resolution.updatedAt)}
                </span>
              </div>
              <ul className="approval-history">
                {resolutionView.resolution.items.map((item) => (
                  <li
                    key={`${resolutionView.resolution.catalogEntryId}:${item.item}`}
                  >
                    <strong>{item.state}</strong>: {item.item}
                  </li>
                ))}
              </ul>
              {resolutionView.resolution.resolutionNote ? (
                <p className="empty-copy">
                  {resolutionView.resolution.resolutionNote}
                </p>
              ) : null}
              <div className="timeline-meta">
                operator {resolutionView.resolution.operatorId} · scope{" "}
                {resolutionView.resolution.scopeId}
              </div>
              <div className="row spread">
                <a
                  className="link-button"
                  href={buildCatalogEntryHref(
                    resolutionView.blocker.progress.checklist.assignment.review
                      .visibility.catalogEntry.entry.id,
                  )}
                >
                  Apply resolved preset
                </a>
                <form
                  action="/runs/catalog"
                  className="action-form"
                  method="post"
                >
                  <input
                    name="returnTo"
                    type="hidden"
                    value={buildCatalogEntryHref(
                      resolutionView.blocker.progress.checklist.assignment
                        .review.visibility.catalogEntry.entry.id,
                    )}
                  />
                  <input name="intent" type="hidden" value="clear-resolution" />
                  <input
                    name="catalogEntryId"
                    type="hidden"
                    value={
                      resolutionView.blocker.progress.checklist.assignment
                        .review.visibility.catalogEntry.entry.id
                    }
                  />
                  <button type="submit">Clear resolutions</button>
                </form>
              </div>
              {activeCatalogChecklistItemResolution?.blocker.progress.checklist
                .assignment.review.visibility.catalogEntry.entry.id ===
              resolutionView.blocker.progress.checklist.assignment.review
                .visibility.catalogEntry.entry.id ? (
                <div className="timeline-meta">Currently applied</div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ChecklistItemVerificationsView({
  activeCatalogChecklistItemVerification,
  verifiedEntries,
}: Readonly<{
  activeCatalogChecklistItemVerification?: ApiAuditCatalogChecklistItemVerificationView;
  verifiedEntries: ApiAuditCatalogChecklistItemVerificationCollection;
}>) {
  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">
            Phase 24 / Checklist Item Verifications
          </div>
          <h2>Checklist item verifications</h2>
          <p className="empty-copy">
            Track thin per-item verifications and a single verification note on
            resolved blocked presets without turning the console into a workflow
            engine or collaboration product.
          </p>
        </div>
        <div className="timeline-count">
          {verifiedEntries.totalCount} verified preset(s)
        </div>
      </div>

      {activeCatalogChecklistItemVerification ? (
        <div className="inline-note">
          Active verifications:{" "}
          <strong>
            {
              activeCatalogChecklistItemVerification.resolution.blocker.progress
                .checklist.assignment.review.visibility.catalogEntry.entry.name
            }
          </strong>
          {" · "}
          {formatVerificationSummary(
            activeCatalogChecklistItemVerification.verification.items,
          )}
          {activeCatalogChecklistItemVerification.verification.verificationNote
            ? ` · ${activeCatalogChecklistItemVerification.verification.verificationNote}`
            : ""}
        </div>
      ) : null}

      {verifiedEntries.items.length === 0 ? (
        <p className="empty-copy">
          No checklist item verifications yet. Record resolutions first, then
          save thin verification metadata through the shared operator seam.
        </p>
      ) : (
        <ol className="timeline-list">
          {verifiedEntries.items.map((verificationView) => (
            <li
              className="timeline-entry"
              key={
                verificationView.resolution.blocker.progress.checklist
                  .assignment.review.visibility.catalogEntry.entry.id
              }
            >
              <div className="row spread">
                <div>
                  <strong>
                    {
                      verificationView.resolution.blocker.progress.checklist
                        .assignment.review.visibility.catalogEntry.entry.name
                    }
                  </strong>
                  <div className="timeline-meta">
                    {formatVerificationSummary(
                      verificationView.verification.items,
                    )}
                    {" · "}
                    {formatResolutionSummary(
                      verificationView.resolution.resolution.items,
                    )}
                    {" · "}
                    {formatBlockerSummary(
                      verificationView.resolution.blocker.blocker.items,
                    )}
                  </div>
                </div>
                <span>
                  {formatTimestamp(verificationView.verification.updatedAt)}
                </span>
              </div>
              <ul className="approval-history">
                {verificationView.verification.items.map((item) => (
                  <li
                    key={`${verificationView.verification.catalogEntryId}:${item.item}`}
                  >
                    <strong>{item.state}</strong>: {item.item}
                  </li>
                ))}
              </ul>
              {verificationView.verification.verificationNote ? (
                <p className="empty-copy">
                  {verificationView.verification.verificationNote}
                </p>
              ) : null}
              <div className="timeline-meta">
                operator {verificationView.verification.operatorId} · scope{" "}
                {verificationView.verification.scopeId}
              </div>
              <div className="row spread">
                <a
                  className="link-button"
                  href={buildCatalogEntryHref(
                    verificationView.resolution.blocker.progress.checklist
                      .assignment.review.visibility.catalogEntry.entry.id,
                  )}
                >
                  Apply verified preset
                </a>
                <form
                  action="/runs/catalog"
                  className="action-form"
                  method="post"
                >
                  <input
                    name="returnTo"
                    type="hidden"
                    value={buildCatalogEntryHref(
                      verificationView.resolution.blocker.progress.checklist
                        .assignment.review.visibility.catalogEntry.entry.id,
                    )}
                  />
                  <input
                    name="intent"
                    type="hidden"
                    value="clear-verification"
                  />
                  <input
                    name="catalogEntryId"
                    type="hidden"
                    value={
                      verificationView.resolution.blocker.progress.checklist
                        .assignment.review.visibility.catalogEntry.entry.id
                    }
                  />
                  <button type="submit">Clear verifications</button>
                </form>
              </div>
              {activeCatalogChecklistItemVerification?.resolution.blocker
                .progress.checklist.assignment.review.visibility.catalogEntry
                .entry.id ===
              verificationView.resolution.blocker.progress.checklist.assignment
                .review.visibility.catalogEntry.entry.id ? (
                <div className="timeline-meta">Currently applied</div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ChecklistItemEvidencesView({
  activeCatalogChecklistItemEvidence,
  evidencedEntries,
}: Readonly<{
  activeCatalogChecklistItemEvidence?: ApiAuditCatalogChecklistItemEvidenceView;
  evidencedEntries: ApiAuditCatalogChecklistItemEvidenceCollection;
}>) {
  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">Phase 25 / Checklist Item Evidence</div>
          <h2>Checklist item evidence</h2>
          <p className="empty-copy">
            Track thin per-item evidence references and a single evidence note
            on verified presets without turning the console into an artifact
            vault, workflow engine, or collaboration product.
          </p>
        </div>
        <div className="timeline-count">
          {evidencedEntries.totalCount} evidenced preset(s)
        </div>
      </div>

      {activeCatalogChecklistItemEvidence ? (
        <div className="inline-note">
          Active evidence:{" "}
          <strong>
            {
              activeCatalogChecklistItemEvidence.verification.resolution.blocker
                .progress.checklist.assignment.review.visibility.catalogEntry
                .entry.name
            }
          </strong>
          {" · "}
          {formatEvidenceSummary(
            activeCatalogChecklistItemEvidence.evidence.items,
          )}
          {activeCatalogChecklistItemEvidence.evidence.evidenceNote
            ? ` · ${activeCatalogChecklistItemEvidence.evidence.evidenceNote}`
            : ""}
        </div>
      ) : null}

      {evidencedEntries.items.length === 0 ? (
        <p className="empty-copy">
          No checklist item evidence yet. Record verifications first, then save
          thin evidence references through the shared operator seam.
        </p>
      ) : (
        <ol className="timeline-list">
          {evidencedEntries.items.map((evidenceView) => (
            <li
              className="timeline-entry"
              key={
                evidenceView.verification.resolution.blocker.progress.checklist
                  .assignment.review.visibility.catalogEntry.entry.id
              }
            >
              <div className="row spread">
                <div>
                  <strong>
                    {
                      evidenceView.verification.resolution.blocker.progress
                        .checklist.assignment.review.visibility.catalogEntry
                        .entry.name
                    }
                  </strong>
                  <div className="timeline-meta">
                    {formatEvidenceSummary(evidenceView.evidence.items)}
                    {" · "}
                    {formatVerificationSummary(
                      evidenceView.verification.verification.items,
                    )}
                    {" · "}
                    {formatResolutionSummary(
                      evidenceView.verification.resolution.resolution.items,
                    )}
                  </div>
                </div>
                <span>{formatTimestamp(evidenceView.evidence.updatedAt)}</span>
              </div>
              <ul className="approval-history">
                {evidenceView.evidence.items.map((item) => (
                  <li
                    key={`${evidenceView.evidence.catalogEntryId}:${item.item}`}
                  >
                    <strong>{item.item}</strong>: {item.references.join(" | ")}
                  </li>
                ))}
              </ul>
              {evidenceView.evidence.evidenceNote ? (
                <p className="empty-copy">
                  {evidenceView.evidence.evidenceNote}
                </p>
              ) : null}
              <div className="timeline-meta">
                operator {evidenceView.evidence.operatorId} · scope{" "}
                {evidenceView.evidence.scopeId}
              </div>
              <div className="row spread">
                <a
                  className="link-button"
                  href={buildCatalogEntryHref(
                    evidenceView.verification.resolution.blocker.progress
                      .checklist.assignment.review.visibility.catalogEntry.entry
                      .id,
                  )}
                >
                  Apply evidenced preset
                </a>
                <form
                  action="/runs/catalog"
                  className="action-form"
                  method="post"
                >
                  <input
                    name="returnTo"
                    type="hidden"
                    value={buildCatalogEntryHref(
                      evidenceView.verification.resolution.blocker.progress
                        .checklist.assignment.review.visibility.catalogEntry
                        .entry.id,
                    )}
                  />
                  <input name="intent" type="hidden" value="clear-evidence" />
                  <input
                    name="catalogEntryId"
                    type="hidden"
                    value={
                      evidenceView.verification.resolution.blocker.progress
                        .checklist.assignment.review.visibility.catalogEntry
                        .entry.id
                    }
                  />
                  <button type="submit">Clear evidence</button>
                </form>
              </div>
              {activeCatalogChecklistItemEvidence?.verification.resolution
                .blocker.progress.checklist.assignment.review.visibility
                .catalogEntry.entry.id ===
              evidenceView.verification.resolution.blocker.progress.checklist
                .assignment.review.visibility.catalogEntry.entry.id ? (
                <div className="timeline-meta">Currently applied</div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ChecklistItemAttestationsView({
  activeCatalogChecklistItemAttestation,
  attestedEntries,
}: Readonly<{
  activeCatalogChecklistItemAttestation?: ApiAuditCatalogChecklistItemAttestationView;
  attestedEntries: ApiAuditCatalogChecklistItemAttestationCollection;
}>) {
  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">
            Phase 26 / Checklist Item Attestations
          </div>
          <h2>Checklist item attestations</h2>
          <p className="empty-copy">
            Track thin per-item attestations and a single attestation note on
            evidenced presets without turning the console into an artifact
            vault, workflow engine, or collaboration product.
          </p>
        </div>
        <div className="timeline-count">
          {attestedEntries.totalCount} attested preset(s)
        </div>
      </div>

      {activeCatalogChecklistItemAttestation ? (
        <div className="inline-note">
          Active attestations:{" "}
          <strong>
            {
              activeCatalogChecklistItemAttestation.evidence.verification
                .resolution.blocker.progress.checklist.assignment.review
                .visibility.catalogEntry.entry.name
            }
          </strong>
          {" · "}
          {formatAttestationSummary(
            activeCatalogChecklistItemAttestation.attestation.items,
          )}
          {activeCatalogChecklistItemAttestation.attestation.attestationNote
            ? ` · ${activeCatalogChecklistItemAttestation.attestation.attestationNote}`
            : ""}
        </div>
      ) : null}

      {attestedEntries.items.length === 0 ? (
        <p className="empty-copy">
          No checklist item attestations yet. Record evidence first, then save
          thin attestation metadata through the shared operator seam.
        </p>
      ) : (
        <ol className="timeline-list">
          {attestedEntries.items.map((attestationView) => (
            <li
              className="timeline-entry"
              key={
                attestationView.evidence.verification.resolution.blocker
                  .progress.checklist.assignment.review.visibility.catalogEntry
                  .entry.id
              }
            >
              <div className="row spread">
                <div>
                  <strong>
                    {
                      attestationView.evidence.verification.resolution.blocker
                        .progress.checklist.assignment.review.visibility
                        .catalogEntry.entry.name
                    }
                  </strong>
                  <div className="timeline-meta">
                    {formatAttestationSummary(
                      attestationView.attestation.items,
                    )}
                    {" · "}
                    {formatEvidenceSummary(
                      attestationView.evidence.evidence.items,
                    )}
                    {" · "}
                    {formatVerificationSummary(
                      attestationView.evidence.verification.verification.items,
                    )}
                  </div>
                </div>
                <span>
                  {formatTimestamp(attestationView.attestation.updatedAt)}
                </span>
              </div>
              <ul className="approval-history">
                {attestationView.attestation.items.map((item) => (
                  <li
                    key={`${attestationView.attestation.catalogEntryId}:${item.item}`}
                  >
                    <strong>{item.state}</strong>: {item.item}
                  </li>
                ))}
              </ul>
              {attestationView.attestation.attestationNote ? (
                <p className="empty-copy">
                  {attestationView.attestation.attestationNote}
                </p>
              ) : null}
              <div className="timeline-meta">
                operator {attestationView.attestation.operatorId} · scope{" "}
                {attestationView.attestation.scopeId}
              </div>
              <div className="row spread">
                <a
                  className="link-button"
                  href={buildCatalogEntryHref(
                    attestationView.evidence.verification.resolution.blocker
                      .progress.checklist.assignment.review.visibility
                      .catalogEntry.entry.id,
                  )}
                >
                  Apply attested preset
                </a>
                <form
                  action="/runs/catalog"
                  className="action-form"
                  method="post"
                >
                  <input
                    name="returnTo"
                    type="hidden"
                    value={buildCatalogEntryHref(
                      attestationView.evidence.verification.resolution.blocker
                        .progress.checklist.assignment.review.visibility
                        .catalogEntry.entry.id,
                    )}
                  />
                  <input
                    name="intent"
                    type="hidden"
                    value="clear-attestation"
                  />
                  <input
                    name="catalogEntryId"
                    type="hidden"
                    value={
                      attestationView.evidence.verification.resolution.blocker
                        .progress.checklist.assignment.review.visibility
                        .catalogEntry.entry.id
                    }
                  />
                  <button type="submit">Clear attestations</button>
                </form>
              </div>
              {activeCatalogChecklistItemAttestation?.evidence.verification
                .resolution.blocker.progress.checklist.assignment.review
                .visibility.catalogEntry.entry.id ===
              attestationView.evidence.verification.resolution.blocker.progress
                .checklist.assignment.review.visibility.catalogEntry.entry
                .id ? (
                <div className="timeline-meta">Currently applied</div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ChecklistItemAcknowledgmentsView({
  activeCatalogChecklistItemAcknowledgment,
  acknowledgedEntries,
}: Readonly<{
  activeCatalogChecklistItemAcknowledgment?: ApiAuditCatalogChecklistItemAcknowledgmentView;
  acknowledgedEntries: ApiAuditCatalogChecklistItemAcknowledgmentCollection;
}>) {
  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">
            Phase 27 / Checklist Item Acknowledgments
          </div>
          <h2>Checklist item acknowledgments</h2>
          <p className="empty-copy">
            Track thin per-item acknowledgments and a single acknowledgment note
            on attested presets without turning the console into an approval
            product, workflow engine, or collaboration surface.
          </p>
        </div>
        <div className="timeline-count">
          {acknowledgedEntries.totalCount} acknowledged preset(s)
        </div>
      </div>

      {activeCatalogChecklistItemAcknowledgment ? (
        <div className="inline-note">
          Active acknowledgments:{" "}
          <strong>
            {
              activeCatalogChecklistItemAcknowledgment.attestation.evidence
                .verification.resolution.blocker.progress.checklist.assignment
                .review.visibility.catalogEntry.entry.name
            }
          </strong>
          {" · "}
          {formatAcknowledgmentSummary(
            activeCatalogChecklistItemAcknowledgment.acknowledgment.items,
          )}
          {activeCatalogChecklistItemAcknowledgment.acknowledgment
            .acknowledgmentNote
            ? ` · ${activeCatalogChecklistItemAcknowledgment.acknowledgment.acknowledgmentNote}`
            : ""}
        </div>
      ) : null}

      {acknowledgedEntries.items.length === 0 ? (
        <p className="empty-copy">
          No checklist item acknowledgments yet. Record attestations first, then
          save thin acknowledgment metadata through the shared operator seam.
        </p>
      ) : (
        <ol className="timeline-list">
          {acknowledgedEntries.items.map((acknowledgmentView) => (
            <li
              className="timeline-entry"
              key={
                acknowledgmentView.attestation.evidence.verification.resolution
                  .blocker.progress.checklist.assignment.review.visibility
                  .catalogEntry.entry.id
              }
            >
              <div className="row spread">
                <div>
                  <strong>
                    {
                      acknowledgmentView.attestation.evidence.verification
                        .resolution.blocker.progress.checklist.assignment.review
                        .visibility.catalogEntry.entry.name
                    }
                  </strong>
                  <div className="timeline-meta">
                    {formatAcknowledgmentSummary(
                      acknowledgmentView.acknowledgment.items,
                    )}
                    {" · "}
                    {formatAttestationSummary(
                      acknowledgmentView.attestation.attestation.items,
                    )}
                    {" · "}
                    {formatEvidenceSummary(
                      acknowledgmentView.attestation.evidence.evidence.items,
                    )}
                  </div>
                </div>
                <span>
                  {formatTimestamp(acknowledgmentView.acknowledgment.updatedAt)}
                </span>
              </div>
              <ul className="approval-history">
                {acknowledgmentView.acknowledgment.items.map((item) => (
                  <li
                    key={`${acknowledgmentView.acknowledgment.catalogEntryId}:${item.item}`}
                  >
                    <strong>{item.state}</strong>: {item.item}
                  </li>
                ))}
              </ul>
              {acknowledgmentView.acknowledgment.acknowledgmentNote ? (
                <p className="empty-copy">
                  {acknowledgmentView.acknowledgment.acknowledgmentNote}
                </p>
              ) : null}
              <div className="timeline-meta">
                operator {acknowledgmentView.acknowledgment.operatorId} · scope{" "}
                {acknowledgmentView.acknowledgment.scopeId}
              </div>
              <div className="row spread">
                <a
                  className="link-button"
                  href={buildCatalogEntryHref(
                    acknowledgmentView.attestation.evidence.verification
                      .resolution.blocker.progress.checklist.assignment.review
                      .visibility.catalogEntry.entry.id,
                  )}
                >
                  Apply acknowledged preset
                </a>
                <form
                  action="/runs/catalog"
                  className="action-form"
                  method="post"
                >
                  <input
                    name="returnTo"
                    type="hidden"
                    value={buildCatalogEntryHref(
                      acknowledgmentView.attestation.evidence.verification
                        .resolution.blocker.progress.checklist.assignment.review
                        .visibility.catalogEntry.entry.id,
                    )}
                  />
                  <input
                    name="intent"
                    type="hidden"
                    value="clear-acknowledgment"
                  />
                  <input
                    name="catalogEntryId"
                    type="hidden"
                    value={
                      acknowledgmentView.attestation.evidence.verification
                        .resolution.blocker.progress.checklist.assignment.review
                        .visibility.catalogEntry.entry.id
                    }
                  />
                  <button type="submit">Clear acknowledgments</button>
                </form>
              </div>
              {activeCatalogChecklistItemAcknowledgment?.acknowledgment
                .catalogEntryId ===
              acknowledgmentView.acknowledgment.catalogEntryId ? (
                <div className="timeline-meta">
                  Active acknowledgments selected
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ChecklistItemExceptionsView({
  activeCatalogChecklistItemException,
  exceptedEntries,
}: Readonly<{
  activeCatalogChecklistItemException?: ApiAuditCatalogChecklistItemExceptionView;
  exceptedEntries: ApiAuditCatalogChecklistItemExceptionCollection;
}>) {
  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">
            Phase 29 / Checklist Item Exceptions
          </div>
          <h2>Checklist item exceptions</h2>
          <p className="empty-copy">
            Track thin per-item exceptions and a single exception note on
            signed-off presets without turning the console into an approval
            product, workflow engine, or collaboration surface.
          </p>
        </div>
        <div className="timeline-count">
          {exceptedEntries.totalCount} excepted preset(s)
        </div>
      </div>

      {activeCatalogChecklistItemException ? (
        <div className="inline-note">
          Active exceptions:{" "}
          <strong>
            {
              activeCatalogChecklistItemException.signoff.acknowledgment
                .attestation.evidence.verification.resolution.blocker.progress
                .checklist.assignment.review.visibility.catalogEntry.entry.name
            }
          </strong>
          {" · "}
          {formatExceptionSummary(
            activeCatalogChecklistItemException.exception.items,
          )}
          {activeCatalogChecklistItemException.exception.exceptionNote
            ? ` · ${activeCatalogChecklistItemException.exception.exceptionNote}`
            : ""}
        </div>
      ) : null}

      {exceptedEntries.items.length === 0 ? (
        <p className="empty-copy">
          No checklist item exceptions yet. Record sign-offs first, then save
          thin exception metadata through the shared operator seam.
        </p>
      ) : (
        <ol className="timeline-list">
          {exceptedEntries.items.map((exceptionView) => (
            <li
              className="timeline-entry"
              key={
                exceptionView.signoff.acknowledgment.attestation.evidence
                  .verification.resolution.blocker.progress.checklist.assignment
                  .review.visibility.catalogEntry.entry.id
              }
            >
              <div className="row spread">
                <div>
                  <strong>
                    {
                      exceptionView.signoff.acknowledgment.attestation.evidence
                        .verification.resolution.blocker.progress.checklist
                        .assignment.review.visibility.catalogEntry.entry.name
                    }
                  </strong>
                  <div className="timeline-meta">
                    {formatExceptionSummary(exceptionView.exception.items)}
                    {" · "}
                    {formatSignoffSummary(exceptionView.signoff.signoff.items)}
                    {" · "}
                    {formatAcknowledgmentSummary(
                      exceptionView.signoff.acknowledgment.acknowledgment.items,
                    )}
                  </div>
                </div>
                <span>
                  {formatTimestamp(exceptionView.exception.updatedAt)}
                </span>
              </div>
              <ul className="approval-history">
                {exceptionView.exception.items.map((item) => (
                  <li
                    key={`${exceptionView.exception.catalogEntryId}:${item.item}`}
                  >
                    <strong>{item.state}</strong>: {item.item}
                  </li>
                ))}
              </ul>
              {exceptionView.exception.exceptionNote ? (
                <p className="empty-copy">
                  {exceptionView.exception.exceptionNote}
                </p>
              ) : null}
              <div className="timeline-meta">
                operator {exceptionView.exception.operatorId} · scope{" "}
                {exceptionView.exception.scopeId}
              </div>
              <div className="row spread">
                <a
                  className="link-button"
                  href={buildCatalogEntryHref(
                    exceptionView.signoff.acknowledgment.attestation.evidence
                      .verification.resolution.blocker.progress.checklist
                      .assignment.review.visibility.catalogEntry.entry.id,
                  )}
                >
                  Apply excepted preset
                </a>
                <form
                  action="/runs/catalog"
                  className="action-form"
                  method="post"
                >
                  <input
                    name="returnTo"
                    type="hidden"
                    value={buildCatalogEntryHref(
                      exceptionView.signoff.acknowledgment.attestation.evidence
                        .verification.resolution.blocker.progress.checklist
                        .assignment.review.visibility.catalogEntry.entry.id,
                    )}
                  />
                  <input name="intent" type="hidden" value="clear-exception" />
                  <input
                    name="catalogEntryId"
                    type="hidden"
                    value={
                      exceptionView.signoff.acknowledgment.attestation.evidence
                        .verification.resolution.blocker.progress.checklist
                        .assignment.review.visibility.catalogEntry.entry.id
                    }
                  />
                  <button type="submit">Clear exceptions</button>
                </form>
              </div>
              {activeCatalogChecklistItemException?.exception.catalogEntryId ===
              exceptionView.exception.catalogEntryId ? (
                <div className="timeline-meta">Active exceptions selected</div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ChecklistItemSignoffsView({
  activeCatalogChecklistItemSignoff,
  signedOffEntries,
}: Readonly<{
  activeCatalogChecklistItemSignoff?: ApiAuditCatalogChecklistItemSignoffView;
  signedOffEntries: ApiAuditCatalogChecklistItemSignoffCollection;
}>) {
  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">
            Phase 28 / Checklist Item Sign-Offs
          </div>
          <h2>Checklist item sign-offs</h2>
          <p className="empty-copy">
            Track thin per-item sign-offs and a single sign-off note on
            acknowledged presets without turning the console into an approval
            product, workflow engine, or collaboration surface.
          </p>
        </div>
        <div className="timeline-count">
          {signedOffEntries.totalCount} signed-off preset(s)
        </div>
      </div>

      {activeCatalogChecklistItemSignoff ? (
        <div className="inline-note">
          Active sign-offs:{" "}
          <strong>
            {
              activeCatalogChecklistItemSignoff.acknowledgment.attestation
                .evidence.verification.resolution.blocker.progress.checklist
                .assignment.review.visibility.catalogEntry.entry.name
            }
          </strong>
          {" · "}
          {formatSignoffSummary(
            activeCatalogChecklistItemSignoff.signoff.items,
          )}
          {activeCatalogChecklistItemSignoff.signoff.signoffNote
            ? ` · ${activeCatalogChecklistItemSignoff.signoff.signoffNote}`
            : ""}
        </div>
      ) : null}

      {signedOffEntries.items.length === 0 ? (
        <p className="empty-copy">
          No checklist item sign-offs yet. Record acknowledgments first, then
          save thin sign-off metadata through the shared operator seam.
        </p>
      ) : (
        <ol className="timeline-list">
          {signedOffEntries.items.map((signoffView) => (
            <li
              className="timeline-entry"
              key={
                signoffView.acknowledgment.attestation.evidence.verification
                  .resolution.blocker.progress.checklist.assignment.review
                  .visibility.catalogEntry.entry.id
              }
            >
              <div className="row spread">
                <div>
                  <strong>
                    {
                      signoffView.acknowledgment.attestation.evidence
                        .verification.resolution.blocker.progress.checklist
                        .assignment.review.visibility.catalogEntry.entry.name
                    }
                  </strong>
                  <div className="timeline-meta">
                    {formatSignoffSummary(signoffView.signoff.items)}
                    {" · "}
                    {formatAcknowledgmentSummary(
                      signoffView.acknowledgment.acknowledgment.items,
                    )}
                    {" · "}
                    {formatAttestationSummary(
                      signoffView.acknowledgment.attestation.attestation.items,
                    )}
                  </div>
                </div>
                <span>{formatTimestamp(signoffView.signoff.updatedAt)}</span>
              </div>
              <ul className="approval-history">
                {signoffView.signoff.items.map((item) => (
                  <li
                    key={`${signoffView.signoff.catalogEntryId}:${item.item}`}
                  >
                    <strong>{item.state}</strong>: {item.item}
                  </li>
                ))}
              </ul>
              {signoffView.signoff.signoffNote ? (
                <p className="empty-copy">{signoffView.signoff.signoffNote}</p>
              ) : null}
              <div className="timeline-meta">
                operator {signoffView.signoff.operatorId} · scope{" "}
                {signoffView.signoff.scopeId}
              </div>
              <div className="row spread">
                <a
                  className="link-button"
                  href={buildCatalogEntryHref(
                    signoffView.acknowledgment.attestation.evidence.verification
                      .resolution.blocker.progress.checklist.assignment.review
                      .visibility.catalogEntry.entry.id,
                  )}
                >
                  Apply signed-off preset
                </a>
                <form
                  action="/runs/catalog"
                  className="action-form"
                  method="post"
                >
                  <input
                    name="returnTo"
                    type="hidden"
                    value={buildCatalogEntryHref(
                      signoffView.acknowledgment.attestation.evidence
                        .verification.resolution.blocker.progress.checklist
                        .assignment.review.visibility.catalogEntry.entry.id,
                    )}
                  />
                  <input name="intent" type="hidden" value="clear-sign-off" />
                  <input
                    name="catalogEntryId"
                    type="hidden"
                    value={
                      signoffView.acknowledgment.attestation.evidence
                        .verification.resolution.blocker.progress.checklist
                        .assignment.review.visibility.catalogEntry.entry.id
                    }
                  />
                  <button type="submit">Clear sign-offs</button>
                </form>
              </div>
              {activeCatalogChecklistItemSignoff?.signoff.catalogEntryId ===
              signoffView.signoff.catalogEntryId ? (
                <div className="timeline-meta">Active sign-offs selected</div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function CatalogReviewAssignmentsView({
  activeCatalogReviewAssignment,
  assignedEntries,
}: Readonly<{
  activeCatalogReviewAssignment?: ApiAuditCatalogReviewAssignmentView;
  assignedEntries: ApiAuditCatalogReviewAssignmentCollection;
}>) {
  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">
            Phase 19 / Catalog Review Assignments
          </div>
          <h2>Catalog review assignments</h2>
          <p className="empty-copy">
            Assign reviewed presets to another operator with a thin handoff note
            without turning the console into a threaded collaboration or
            permission product.
          </p>
        </div>
        <div className="timeline-count">
          {assignedEntries.totalCount} assigned preset(s)
        </div>
      </div>

      {activeCatalogReviewAssignment ? (
        <div className="inline-note">
          Active assignment:{" "}
          <strong>
            {
              activeCatalogReviewAssignment.review.visibility.catalogEntry.entry
                .name
            }
          </strong>
          {" · "}assignee {activeCatalogReviewAssignment.assignment.assigneeId}
          {activeCatalogReviewAssignment.assignment.handoffNote
            ? ` · ${activeCatalogReviewAssignment.assignment.handoffNote}`
            : ""}
        </div>
      ) : null}

      {assignedEntries.items.length === 0 ? (
        <p className="empty-copy">
          No review assignments yet. Review a visible preset first, then assign
          it through the shared operator seam.
        </p>
      ) : (
        <ol className="timeline-list">
          {assignedEntries.items.map((assignmentView) => (
            <li
              className="timeline-entry"
              key={assignmentView.review.visibility.catalogEntry.entry.id}
            >
              <div className="row spread">
                <div>
                  <strong>
                    {assignmentView.review.visibility.catalogEntry.entry.name}
                  </strong>
                  <div className="timeline-meta">
                    {assignmentView.assignment.state} ·{" "}
                    {assignmentView.review.review.state}
                    {" · "}
                    {assignmentView.review.visibility.visibility.state}
                  </div>
                </div>
                <span>
                  {formatTimestamp(assignmentView.assignment.updatedAt)}
                </span>
              </div>
              {assignmentView.assignment.handoffNote ? (
                <p className="empty-copy">
                  {assignmentView.assignment.handoffNote}
                </p>
              ) : null}
              <div className="timeline-meta">
                assigner {assignmentView.assignment.assignerId} · assignee{" "}
                {assignmentView.assignment.assigneeId}
                {" · "}scope {assignmentView.assignment.scopeId}
              </div>
              <div className="row spread">
                <a
                  className="link-button"
                  href={buildCatalogEntryHref(
                    assignmentView.review.visibility.catalogEntry.entry.id,
                  )}
                >
                  Apply assigned preset
                </a>
                <form
                  action="/runs/catalog"
                  className="action-form"
                  method="post"
                >
                  <input
                    name="returnTo"
                    type="hidden"
                    value={buildCatalogEntryHref(
                      assignmentView.review.visibility.catalogEntry.entry.id,
                    )}
                  />
                  <input name="intent" type="hidden" value="clear-assignment" />
                  <input
                    name="catalogEntryId"
                    type="hidden"
                    value={
                      assignmentView.review.visibility.catalogEntry.entry.id
                    }
                  />
                  <button type="submit">Clear assignment</button>
                </form>
              </div>
              {activeCatalogReviewAssignment?.review.visibility.catalogEntry
                .entry.id ===
              assignmentView.review.visibility.catalogEntry.entry.id ? (
                <div className="timeline-meta">Currently applied</div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function CatalogReviewSignalsView({
  activeCatalogReviewSignal,
  reviewedEntries,
}: Readonly<{
  activeCatalogReviewSignal?: ApiAuditCatalogReviewSignalView;
  reviewedEntries: ApiAuditCatalogReviewSignalCollection;
}>) {
  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">Phase 18 / Catalog Review Signals</div>
          <h2>Catalog review signals</h2>
          <p className="empty-copy">
            Add thin review state and shared notes to visible presets without
            turning the web console into a threaded collaboration or discovery
            product.
          </p>
        </div>
        <div className="timeline-count">
          {reviewedEntries.totalCount} reviewed preset(s)
        </div>
      </div>

      {activeCatalogReviewSignal ? (
        <div className="inline-note">
          Active review signal:{" "}
          <strong>
            {activeCatalogReviewSignal.visibility.catalogEntry.entry.name}
          </strong>
          {" · "}
          {activeCatalogReviewSignal.review.state}
          {activeCatalogReviewSignal.review.note
            ? ` · ${activeCatalogReviewSignal.review.note}`
            : ""}
        </div>
      ) : null}

      {reviewedEntries.items.length === 0 ? (
        <p className="empty-copy">
          No review signals yet. Review a visible preset to publish a thin
          recommendation or note through the shared operator seam.
        </p>
      ) : (
        <ol className="timeline-list">
          {reviewedEntries.items.map((reviewSignal) => (
            <li
              className="timeline-entry"
              key={reviewSignal.visibility.catalogEntry.entry.id}
            >
              <div className="row spread">
                <div>
                  <strong>
                    {reviewSignal.visibility.catalogEntry.entry.name}
                  </strong>
                  <div className="timeline-meta">
                    {reviewSignal.review.state} ·{" "}
                    {reviewSignal.visibility.visibility.state}
                  </div>
                </div>
                <span>{formatTimestamp(reviewSignal.review.updatedAt)}</span>
              </div>
              {reviewSignal.review.note ? (
                <p className="empty-copy">{reviewSignal.review.note}</p>
              ) : null}
              <div className="timeline-meta">
                reviewer {reviewSignal.review.operatorId} · scope{" "}
                {reviewSignal.review.scopeId}
              </div>
              <div className="row spread">
                <a
                  className="link-button"
                  href={buildCatalogEntryHref(
                    reviewSignal.visibility.catalogEntry.entry.id,
                  )}
                >
                  Apply reviewed preset
                </a>
                <form
                  action="/runs/catalog"
                  className="action-form"
                  method="post"
                >
                  <input
                    name="returnTo"
                    type="hidden"
                    value={buildCatalogEntryHref(
                      reviewSignal.visibility.catalogEntry.entry.id,
                    )}
                  />
                  <input name="intent" type="hidden" value="clear-review" />
                  <input
                    name="catalogEntryId"
                    type="hidden"
                    value={reviewSignal.visibility.catalogEntry.entry.id}
                  />
                  <button type="submit">Clear review</button>
                </form>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function AuditViewCatalogsView({
  activeCatalogEntry,
  activeCatalogChecklistItemBlocker,
  activeCatalogChecklistItemException,
  activeCatalogChecklistItemSignoff,
  activeCatalogChecklistItemAcknowledgment,
  activeCatalogChecklistItemAttestation,
  activeCatalogChecklistItemEvidence,
  activeCatalogChecklistItemResolution,
  activeCatalogChecklistItemVerification,
  activeCatalogChecklistItemProgress,
  assignedEntries,
  exceptedEntries,
  signedOffEntries,
  acknowledgedEntries,
  attestedEntries,
  blockedEntries,
  catalogEntries,
  checklistedEntries,
  evidencedEntries,
  progressedEntries,
  resolvedEntries,
  verifiedEntries,
  reviewedEntries,
}: Readonly<{
  activeCatalogEntry?: ApiAuditCatalogVisibilityView;
  activeCatalogChecklistItemBlocker?: ApiAuditCatalogChecklistItemBlockerView;
  activeCatalogChecklistItemException?: ApiAuditCatalogChecklistItemExceptionView;
  activeCatalogChecklistItemSignoff?: ApiAuditCatalogChecklistItemSignoffView;
  activeCatalogChecklistItemAcknowledgment?: ApiAuditCatalogChecklistItemAcknowledgmentView;
  activeCatalogChecklistItemAttestation?: ApiAuditCatalogChecklistItemAttestationView;
  activeCatalogChecklistItemEvidence?: ApiAuditCatalogChecklistItemEvidenceView;
  activeCatalogChecklistItemResolution?: ApiAuditCatalogChecklistItemResolutionView;
  activeCatalogChecklistItemVerification?: ApiAuditCatalogChecklistItemVerificationView;
  activeCatalogChecklistItemProgress?: ApiAuditCatalogChecklistItemProgressView;
  assignedEntries: ApiAuditCatalogReviewAssignmentCollection;
  exceptedEntries: ApiAuditCatalogChecklistItemExceptionCollection;
  signedOffEntries: ApiAuditCatalogChecklistItemSignoffCollection;
  acknowledgedEntries: ApiAuditCatalogChecklistItemAcknowledgmentCollection;
  attestedEntries: ApiAuditCatalogChecklistItemAttestationCollection;
  blockedEntries: ApiAuditCatalogChecklistItemBlockerCollection;
  catalogEntries: ApiAuditCatalogVisibilityCollection;
  checklistedEntries: ApiAuditCatalogAssignmentChecklistCollection;
  evidencedEntries: ApiAuditCatalogChecklistItemEvidenceCollection;
  progressedEntries: ApiAuditCatalogChecklistItemProgressCollection;
  resolvedEntries: ApiAuditCatalogChecklistItemResolutionCollection;
  verifiedEntries: ApiAuditCatalogChecklistItemVerificationCollection;
  reviewedEntries: ApiAuditCatalogReviewSignalCollection;
}>) {
  const assignmentsByCatalogEntryId = new Map(
    assignedEntries.items.map(
      (item) => [item.review.visibility.catalogEntry.entry.id, item] as const,
    ),
  );
  const reviewSignalsByCatalogEntryId = new Map(
    reviewedEntries.items.map(
      (item) => [item.visibility.catalogEntry.entry.id, item] as const,
    ),
  );
  const checklistsByCatalogEntryId = new Map(
    checklistedEntries.items.map(
      (item) =>
        [
          item.assignment.review.visibility.catalogEntry.entry.id,
          item,
        ] as const,
    ),
  );
  const progressByCatalogEntryId = new Map(
    progressedEntries.items.map(
      (item) =>
        [
          item.checklist.assignment.review.visibility.catalogEntry.entry.id,
          item,
        ] as const,
    ),
  );
  const blockersByCatalogEntryId = new Map(
    blockedEntries.items.map(
      (item) =>
        [
          item.progress.checklist.assignment.review.visibility.catalogEntry
            .entry.id,
          item,
        ] as const,
    ),
  );
  const resolutionsByCatalogEntryId = new Map(
    resolvedEntries.items.map(
      (item) =>
        [
          item.blocker.progress.checklist.assignment.review.visibility
            .catalogEntry.entry.id,
          item,
        ] as const,
    ),
  );
  const verificationsByCatalogEntryId = new Map(
    verifiedEntries.items.map(
      (item) =>
        [
          item.resolution.blocker.progress.checklist.assignment.review
            .visibility.catalogEntry.entry.id,
          item,
        ] as const,
    ),
  );
  const evidencesByCatalogEntryId = new Map(
    evidencedEntries.items.map(
      (item) =>
        [
          item.verification.resolution.blocker.progress.checklist.assignment
            .review.visibility.catalogEntry.entry.id,
          item,
        ] as const,
    ),
  );
  const attestationsByCatalogEntryId = new Map(
    attestedEntries.items.map(
      (item) =>
        [
          item.evidence.verification.resolution.blocker.progress.checklist
            .assignment.review.visibility.catalogEntry.entry.id,
          item,
        ] as const,
    ),
  );
  const acknowledgmentsByCatalogEntryId = new Map(
    acknowledgedEntries.items.map(
      (item) =>
        [
          item.attestation.evidence.verification.resolution.blocker.progress
            .checklist.assignment.review.visibility.catalogEntry.entry.id,
          item,
        ] as const,
    ),
  );
  const signoffsByCatalogEntryId = new Map(
    signedOffEntries.items.map(
      (item) =>
        [
          item.acknowledgment.attestation.evidence.verification.resolution
            .blocker.progress.checklist.assignment.review.visibility
            .catalogEntry.entry.id,
          item,
        ] as const,
    ),
  );
  const exceptionsByCatalogEntryId = new Map(
    exceptedEntries.items.map(
      (item) =>
        [
          item.signoff.acknowledgment.attestation.evidence.verification
            .resolution.blocker.progress.checklist.assignment.review.visibility
            .catalogEntry.entry.id,
          item,
        ] as const,
    ),
  );

  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">Phase 17 / Catalog Visibility</div>
          <h2>Catalog visibility</h2>
          <p className="empty-copy">
            Mark catalog entries as personal or shared without turning the web
            console into a collaboration product or permission framework.
          </p>
        </div>
        <div className="timeline-count">
          {catalogEntries.totalCount} visible catalog entry(s)
        </div>
      </div>

      {activeCatalogEntry ? (
        <div className="inline-note">
          Applying <strong>{activeCatalogEntry.catalogEntry.entry.name}</strong>{" "}
          from the visible catalog.
          <a className="subtle-link" href="/runs">
            Clear catalog entry
          </a>
        </div>
      ) : null}

      {catalogEntries.items.length === 0 ? (
        <p className="empty-copy">
          No visible catalog entries yet. Publish a constrained saved view, then
          choose whether it stays personal or becomes visible within the current
          operator scope.
        </p>
      ) : (
        <ol className="timeline-list">
          {catalogEntries.items.map((catalogEntry) => (
            <li
              className="timeline-entry"
              key={catalogEntry.catalogEntry.entry.id}
            >
              {(() => {
                const assignment = assignmentsByCatalogEntryId.get(
                  catalogEntry.catalogEntry.entry.id,
                );
                const checklist = checklistsByCatalogEntryId.get(
                  catalogEntry.catalogEntry.entry.id,
                );
                const progress = progressByCatalogEntryId.get(
                  catalogEntry.catalogEntry.entry.id,
                );
                const blocker = blockersByCatalogEntryId.get(
                  catalogEntry.catalogEntry.entry.id,
                );
                const resolution = resolutionsByCatalogEntryId.get(
                  catalogEntry.catalogEntry.entry.id,
                );
                const verification = verificationsByCatalogEntryId.get(
                  catalogEntry.catalogEntry.entry.id,
                );
                const evidence =
                  activeCatalogChecklistItemEvidence?.verification.resolution
                    .blocker.progress.checklist.assignment.review.visibility
                    .catalogEntry.entry.id ===
                  catalogEntry.catalogEntry.entry.id
                    ? activeCatalogChecklistItemEvidence
                    : evidencesByCatalogEntryId.get(
                        catalogEntry.catalogEntry.entry.id,
                      );
                const attestation =
                  activeCatalogChecklistItemAttestation?.evidence.verification
                    .resolution.blocker.progress.checklist.assignment.review
                    .visibility.catalogEntry.entry.id ===
                  catalogEntry.catalogEntry.entry.id
                    ? activeCatalogChecklistItemAttestation
                    : attestationsByCatalogEntryId.get(
                        catalogEntry.catalogEntry.entry.id,
                      );
                const acknowledgment =
                  activeCatalogChecklistItemAcknowledgment?.attestation.evidence
                    .verification.resolution.blocker.progress.checklist
                    .assignment.review.visibility.catalogEntry.entry.id ===
                  catalogEntry.catalogEntry.entry.id
                    ? activeCatalogChecklistItemAcknowledgment
                    : acknowledgmentsByCatalogEntryId.get(
                        catalogEntry.catalogEntry.entry.id,
                      );
                const signoff =
                  activeCatalogChecklistItemSignoff?.acknowledgment.attestation
                    .evidence.verification.resolution.blocker.progress.checklist
                    .assignment.review.visibility.catalogEntry.entry.id ===
                  catalogEntry.catalogEntry.entry.id
                    ? activeCatalogChecklistItemSignoff
                    : signoffsByCatalogEntryId.get(
                        catalogEntry.catalogEntry.entry.id,
                      );
                const exception =
                  activeCatalogChecklistItemException?.signoff.acknowledgment
                    .attestation.evidence.verification.resolution.blocker
                    .progress.checklist.assignment.review.visibility
                    .catalogEntry.entry.id ===
                  catalogEntry.catalogEntry.entry.id
                    ? activeCatalogChecklistItemException
                    : exceptionsByCatalogEntryId.get(
                        catalogEntry.catalogEntry.entry.id,
                      );
                const reviewSignal = reviewSignalsByCatalogEntryId.get(
                  catalogEntry.catalogEntry.entry.id,
                );

                return (
                  <>
                    <div className="row spread">
                      <div>
                        <strong>{catalogEntry.catalogEntry.entry.name}</strong>
                        <div className="timeline-meta">
                          {catalogEntry.catalogEntry.entry.kind} ·{" "}
                          {catalogEntry.visibility.state}
                          {reviewSignal
                            ? ` · ${reviewSignal.review.state}`
                            : ""}
                          {assignment
                            ? ` · assigned to ${assignment.assignment.assigneeId}`
                            : ""}
                          {checklist
                            ? ` · checklist ${checklist.checklist.state}`
                            : ""}
                          {progress
                            ? ` · ${formatProgressSummary(progress.progress.items)}`
                            : ""}
                          {blocker
                            ? ` · ${formatBlockerSummary(blocker.blocker.items)}`
                            : ""}
                          {resolution
                            ? ` · ${formatResolutionSummary(
                                resolution.resolution.items,
                              )}`
                            : ""}
                          {verification
                            ? ` · ${formatVerificationSummary(
                                verification.verification.items,
                              )}`
                            : ""}
                          {attestation
                            ? ` · ${formatAttestationSummary(
                                attestation.attestation.items,
                              )}`
                            : ""}
                          {acknowledgment
                            ? ` · ${formatAcknowledgmentSummary(
                                acknowledgment.acknowledgment.items,
                              )}`
                            : ""}
                          {signoff
                            ? ` · ${formatSignoffSummary(signoff.signoff.items)}`
                            : ""}
                          {exception
                            ? ` · ${formatExceptionSummary(
                                exception.exception.items,
                              )}`
                            : ""}
                        </div>
                      </div>
                      <span>
                        {formatTimestamp(catalogEntry.visibility.updatedAt)}
                      </span>
                    </div>
                    {catalogEntry.catalogEntry.entry.description ? (
                      <p className="empty-copy">
                        {catalogEntry.catalogEntry.entry.description}
                      </p>
                    ) : null}
                    {reviewSignal?.review.note ? (
                      <p className="empty-copy">{reviewSignal.review.note}</p>
                    ) : null}
                    {assignment?.assignment.handoffNote ? (
                      <p className="empty-copy">
                        {assignment.assignment.handoffNote}
                      </p>
                    ) : null}
                    {checklist?.checklist.items?.length ? (
                      <p className="empty-copy">
                        checklist: {checklist.checklist.items.join(", ")}
                      </p>
                    ) : null}
                    {progress?.progress.items.length ? (
                      <p className="empty-copy">
                        progress:{" "}
                        {progress.progress.items
                          .map((item) => `${item.state}: ${item.item}`)
                          .join(", ")}
                      </p>
                    ) : null}
                    {progress?.progress.completionNote ? (
                      <p className="empty-copy">
                        completion note: {progress.progress.completionNote}
                      </p>
                    ) : null}
                    {blocker?.blocker.items.length ? (
                      <p className="empty-copy">
                        blockers:{" "}
                        {blocker.blocker.items
                          .map((item) => `${item.state}: ${item.item}`)
                          .join(", ")}
                      </p>
                    ) : null}
                    {blocker?.blocker.blockerNote ? (
                      <p className="empty-copy">
                        blocker note: {blocker.blocker.blockerNote}
                      </p>
                    ) : null}
                    {resolution?.resolution.items.length ? (
                      <p className="empty-copy">
                        resolutions:{" "}
                        {resolution.resolution.items
                          .map((item) => `${item.state}: ${item.item}`)
                          .join(", ")}
                      </p>
                    ) : null}
                    {resolution?.resolution.resolutionNote ? (
                      <p className="empty-copy">
                        resolution note: {resolution.resolution.resolutionNote}
                      </p>
                    ) : null}
                    {verification?.verification.items.length ? (
                      <p className="empty-copy">
                        verifications:{" "}
                        {verification.verification.items
                          .map((item) => `${item.state}: ${item.item}`)
                          .join(", ")}
                      </p>
                    ) : null}
                    {verification?.verification.verificationNote ? (
                      <p className="empty-copy">
                        verification note:{" "}
                        {verification.verification.verificationNote}
                      </p>
                    ) : null}
                    {evidence?.evidence.items.length ? (
                      <p className="empty-copy">
                        evidence:{" "}
                        {evidence.evidence.items
                          .map(
                            (item) =>
                              `${item.item} -> ${item.references.join(" | ")}`,
                          )
                          .join("; ")}
                      </p>
                    ) : null}
                    {evidence?.evidence.evidenceNote ? (
                      <p className="empty-copy">
                        evidence note: {evidence.evidence.evidenceNote}
                      </p>
                    ) : null}
                    {attestation?.attestation.items.length ? (
                      <p className="empty-copy">
                        attestations:{" "}
                        {attestation.attestation.items
                          .map((item) => `${item.state}: ${item.item}`)
                          .join(", ")}
                      </p>
                    ) : null}
                    {attestation?.attestation.attestationNote ? (
                      <p className="empty-copy">
                        attestation note:{" "}
                        {attestation.attestation.attestationNote}
                      </p>
                    ) : null}
                    {acknowledgment?.acknowledgment.items.length ? (
                      <p className="empty-copy">
                        acknowledgments:{" "}
                        {acknowledgment.acknowledgment.items
                          .map((item) => `${item.state}: ${item.item}`)
                          .join(", ")}
                      </p>
                    ) : null}
                    {acknowledgment?.acknowledgment.acknowledgmentNote ? (
                      <p className="empty-copy">
                        acknowledgment note:{" "}
                        {acknowledgment.acknowledgment.acknowledgmentNote}
                      </p>
                    ) : null}
                    <div className="timeline-meta">
                      saved view {catalogEntry.catalogEntry.savedView.id}
                      {catalogEntry.catalogEntry.savedView.refs.auditViewRunId
                        ? ` · audit view ${catalogEntry.catalogEntry.savedView.refs.auditViewRunId}`
                        : ""}
                      {catalogEntry.catalogEntry.savedView.refs.drilldownRunId
                        ? ` · drilldown ${catalogEntry.catalogEntry.savedView.refs.drilldownRunId}`
                        : ""}
                    </div>
                    <div className="timeline-meta">
                      owner {catalogEntry.visibility.ownerId} · scope{" "}
                      {catalogEntry.visibility.scopeId}
                      {reviewSignal
                        ? ` · reviewer ${reviewSignal.review.operatorId}`
                        : ""}
                      {assignment
                        ? ` · assigner ${assignment.assignment.assignerId}`
                        : ""}
                      {checklist
                        ? ` · checklist owner ${checklist.checklist.operatorId}`
                        : ""}
                      {progress
                        ? ` · progress owner ${progress.progress.operatorId}`
                        : ""}
                      {blocker
                        ? ` · blocker owner ${blocker.blocker.operatorId}`
                        : ""}
                      {resolution
                        ? ` · resolution owner ${resolution.resolution.operatorId}`
                        : ""}
                      {verification
                        ? ` · verification owner ${verification.verification.operatorId}`
                        : ""}
                      {evidence
                        ? ` · evidence owner ${evidence.evidence.operatorId}`
                        : ""}
                      {attestation
                        ? ` · attestation owner ${attestation.attestation.operatorId}`
                        : ""}
                      {acknowledgment
                        ? ` · acknowledgment owner ${acknowledgment.acknowledgment.operatorId}`
                        : ""}
                    </div>
                    <div className="timeline-meta">
                      summary filters{" "}
                      {countSavedViewSummaryFilters(
                        catalogEntry.catalogEntry.savedView.navigation.summary,
                      )}
                      {" · "}drilldown filters{" "}
                      {countSavedViewDrilldownFilters(
                        catalogEntry.catalogEntry.savedView.navigation
                          .drilldown,
                      )}
                    </div>
                    <form
                      action="/runs/catalog"
                      className="decision-form"
                      method="post"
                    >
                      <input
                        name="returnTo"
                        type="hidden"
                        value={buildCatalogEntryHref(
                          catalogEntry.catalogEntry.entry.id,
                        )}
                      />
                      <input name="intent" type="hidden" value="review" />
                      <input
                        name="catalogEntryId"
                        type="hidden"
                        value={catalogEntry.catalogEntry.entry.id}
                      />
                      <div className="data-grid">
                        <label>
                          <span>Review state</span>
                          <select
                            defaultValue={
                              reviewSignal?.review.state ?? "recommended"
                            }
                            name="reviewState"
                          >
                            <option value="recommended">recommended</option>
                            <option value="reviewed">reviewed</option>
                          </select>
                        </label>
                        <label>
                          <span>Shared note</span>
                          <input
                            defaultValue={reviewSignal?.review.note ?? ""}
                            name="note"
                            placeholder="Optional thin note"
                            type="text"
                          />
                        </label>
                      </div>
                      <div className="row spread">
                        <div />
                        <button type="submit">
                          {reviewSignal ? "Update review" : "Save review"}
                        </button>
                      </div>
                    </form>
                    {reviewSignal ? (
                      <form
                        action="/runs/catalog"
                        className="decision-form"
                        method="post"
                      >
                        <input
                          name="returnTo"
                          type="hidden"
                          value={buildCatalogEntryHref(
                            catalogEntry.catalogEntry.entry.id,
                          )}
                        />
                        <input name="intent" type="hidden" value="assign" />
                        <input
                          name="catalogEntryId"
                          type="hidden"
                          value={catalogEntry.catalogEntry.entry.id}
                        />
                        <div className="data-grid">
                          <label>
                            <span>Assignee</span>
                            <input
                              defaultValue={
                                assignment?.assignment.assigneeId ?? ""
                              }
                              name="assigneeId"
                              placeholder="operator id"
                              type="text"
                            />
                          </label>
                          <label>
                            <span>Handoff note</span>
                            <input
                              defaultValue={
                                assignment?.assignment.handoffNote ?? ""
                              }
                              name="handoffNote"
                              placeholder="Optional thin handoff note"
                              type="text"
                            />
                          </label>
                        </div>
                        <div className="row spread">
                          <div />
                          <button type="submit">
                            {assignment ? "Update assignment" : "Assign preset"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                    {assignment ? (
                      <form
                        action="/runs/catalog"
                        className="decision-form"
                        method="post"
                      >
                        <input
                          name="returnTo"
                          type="hidden"
                          value={buildCatalogEntryHref(
                            catalogEntry.catalogEntry.entry.id,
                          )}
                        />
                        <input name="intent" type="hidden" value="checklist" />
                        <input
                          name="catalogEntryId"
                          type="hidden"
                          value={catalogEntry.catalogEntry.entry.id}
                        />
                        <div className="data-grid">
                          <label>
                            <span>Handoff status</span>
                            <select
                              defaultValue={
                                checklist?.checklist.state ?? "pending"
                              }
                              name="checklistState"
                            >
                              <option value="pending">pending</option>
                              <option value="completed">completed</option>
                            </select>
                          </label>
                          <label>
                            <span>Checklist items</span>
                            <textarea
                              className="note-input"
                              defaultValue={
                                checklist?.checklist.items?.join("\n") ?? ""
                              }
                              name="checklistItems"
                              placeholder="One checklist item per line"
                              rows={4}
                            />
                          </label>
                        </div>
                        <div className="row spread">
                          <div />
                          <button type="submit">
                            {checklist ? "Update checklist" : "Save checklist"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                    {checklist ? (
                      <form
                        action="/runs/catalog"
                        className="decision-form"
                        method="post"
                      >
                        <input
                          name="returnTo"
                          type="hidden"
                          value={buildCatalogEntryHref(
                            catalogEntry.catalogEntry.entry.id,
                          )}
                        />
                        <input name="intent" type="hidden" value="progress" />
                        <input
                          name="catalogEntryId"
                          type="hidden"
                          value={catalogEntry.catalogEntry.entry.id}
                        />
                        <div className="data-grid">
                          <label>
                            <span>Checklist item progress</span>
                            <textarea
                              className="note-input"
                              defaultValue={formatChecklistItemProgressLines(
                                checklist.checklist.items ?? [],
                                progress?.progress.items,
                              )}
                              name="progressItems"
                              placeholder="pending: Validate queued follow-up"
                              rows={4}
                            />
                          </label>
                          <label>
                            <span>Completion note</span>
                            <input
                              defaultValue={
                                progress?.progress.completionNote ?? ""
                              }
                              name="completionNote"
                              placeholder="Optional thin completion note"
                              type="text"
                            />
                          </label>
                        </div>
                        <div className="row spread">
                          <div />
                          <button type="submit">
                            {progress ? "Update progress" : "Save progress"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                    {progress ? (
                      <form
                        action="/runs/catalog"
                        className="decision-form"
                        method="post"
                      >
                        <input
                          name="returnTo"
                          type="hidden"
                          value={buildCatalogEntryHref(
                            catalogEntry.catalogEntry.entry.id,
                          )}
                        />
                        <input name="intent" type="hidden" value="block" />
                        <input
                          name="catalogEntryId"
                          type="hidden"
                          value={catalogEntry.catalogEntry.entry.id}
                        />
                        <div className="data-grid">
                          <label>
                            <span>Checklist item blockers</span>
                            <textarea
                              className="note-input"
                              defaultValue={formatChecklistItemBlockerLines(
                                progress.progress.items,
                                blocker?.blocker.items,
                              )}
                              name="blockerItems"
                              placeholder="blocked: Validate queued follow-up"
                              rows={4}
                            />
                          </label>
                          <label>
                            <span>Blocker note</span>
                            <input
                              defaultValue={blocker?.blocker.blockerNote ?? ""}
                              name="blockerNote"
                              placeholder="Optional thin blocker note"
                              type="text"
                            />
                          </label>
                        </div>
                        <div className="row spread">
                          <div />
                          <button type="submit">
                            {blocker ? "Update blockers" : "Save blockers"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                    {blocker ? (
                      <form
                        action="/runs/catalog"
                        className="decision-form"
                        method="post"
                      >
                        <input
                          name="returnTo"
                          type="hidden"
                          value={buildCatalogEntryHref(
                            catalogEntry.catalogEntry.entry.id,
                          )}
                        />
                        <input name="intent" type="hidden" value="resolve" />
                        <input
                          name="catalogEntryId"
                          type="hidden"
                          value={catalogEntry.catalogEntry.entry.id}
                        />
                        <div className="data-grid">
                          <label>
                            <span>Checklist item resolutions</span>
                            <textarea
                              className="note-input"
                              defaultValue={formatChecklistItemResolutionLines(
                                blocker.blocker.items,
                                resolution?.resolution.items,
                              )}
                              name="resolutionItems"
                              placeholder="resolved: Validate queued follow-up"
                              rows={4}
                            />
                          </label>
                          <label>
                            <span>Resolution note</span>
                            <input
                              defaultValue={
                                resolution?.resolution.resolutionNote ?? ""
                              }
                              name="resolutionNote"
                              placeholder="Optional thin resolution note"
                              type="text"
                            />
                          </label>
                        </div>
                        <div className="row spread">
                          <div />
                          <button type="submit">
                            {resolution
                              ? "Update resolutions"
                              : "Save resolutions"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                    {resolution ? (
                      <form
                        action="/runs/catalog"
                        className="decision-form"
                        method="post"
                      >
                        <input
                          name="returnTo"
                          type="hidden"
                          value={buildCatalogEntryHref(
                            catalogEntry.catalogEntry.entry.id,
                          )}
                        />
                        <input name="intent" type="hidden" value="verify" />
                        <input
                          name="catalogEntryId"
                          type="hidden"
                          value={catalogEntry.catalogEntry.entry.id}
                        />
                        <div className="data-grid">
                          <label>
                            <span>Checklist item verifications</span>
                            <textarea
                              className="note-input"
                              defaultValue={formatChecklistItemVerificationLines(
                                resolution.resolution.items,
                                verification?.verification.items,
                              )}
                              name="verificationItems"
                              placeholder="verified: Validate queued follow-up"
                              rows={4}
                            />
                          </label>
                          <label>
                            <span>Verification note</span>
                            <input
                              defaultValue={
                                verification?.verification.verificationNote ??
                                ""
                              }
                              name="verificationNote"
                              placeholder="Optional thin verification note"
                              type="text"
                            />
                          </label>
                        </div>
                        <div className="row spread">
                          <div />
                          <button type="submit">
                            {verification
                              ? "Update verifications"
                              : "Save verifications"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                    {verification ? (
                      <form
                        action="/runs/catalog"
                        className="decision-form"
                        method="post"
                      >
                        <input
                          name="returnTo"
                          type="hidden"
                          value={buildCatalogEntryHref(
                            catalogEntry.catalogEntry.entry.id,
                          )}
                        />
                        <input
                          name="intent"
                          type="hidden"
                          value="record-evidence"
                        />
                        <input
                          name="catalogEntryId"
                          type="hidden"
                          value={catalogEntry.catalogEntry.entry.id}
                        />
                        <div className="data-grid">
                          <label>
                            <span>Checklist item evidence</span>
                            <textarea
                              className="note-input"
                              defaultValue={formatChecklistItemEvidenceLines(
                                verification.verification.items,
                                evidence?.evidence.items,
                              )}
                              name="evidenceItems"
                              placeholder="Validate queued follow-up: run://queued-follow-up | note://backup-handoff"
                              rows={4}
                            />
                          </label>
                          <label>
                            <span>Evidence note</span>
                            <input
                              defaultValue={
                                evidence?.evidence.evidenceNote ?? ""
                              }
                              name="evidenceNote"
                              placeholder="Optional thin evidence note"
                              type="text"
                            />
                          </label>
                        </div>
                        <div className="row spread">
                          <div />
                          <button type="submit">
                            {evidence ? "Update evidence" : "Save evidence"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                    {evidence ? (
                      <form
                        action="/runs/catalog"
                        className="decision-form"
                        method="post"
                      >
                        <input
                          name="returnTo"
                          type="hidden"
                          value={buildCatalogEntryHref(
                            catalogEntry.catalogEntry.entry.id,
                          )}
                        />
                        <input name="intent" type="hidden" value="attest" />
                        <input
                          name="catalogEntryId"
                          type="hidden"
                          value={catalogEntry.catalogEntry.entry.id}
                        />
                        <div className="data-grid">
                          <label>
                            <span>Checklist item attestations</span>
                            <textarea
                              className="note-input"
                              defaultValue={formatChecklistItemAttestationLines(
                                evidence.evidence.items,
                                attestation?.attestation.items,
                              )}
                              name="attestationItems"
                              placeholder="attested: Validate queued follow-up"
                              rows={4}
                            />
                          </label>
                          <label>
                            <span>Attestation note</span>
                            <input
                              defaultValue={
                                attestation?.attestation.attestationNote ?? ""
                              }
                              name="attestationNote"
                              placeholder="Optional thin attestation note"
                              type="text"
                            />
                          </label>
                        </div>
                        <div className="row spread">
                          <div />
                          <button type="submit">
                            {attestation
                              ? "Update attestations"
                              : "Save attestations"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                    {attestation ? (
                      <form
                        action="/runs/catalog"
                        className="decision-form"
                        method="post"
                      >
                        <input
                          name="returnTo"
                          type="hidden"
                          value={buildCatalogEntryHref(
                            catalogEntry.catalogEntry.entry.id,
                          )}
                        />
                        <input
                          name="intent"
                          type="hidden"
                          value="acknowledge"
                        />
                        <input
                          name="catalogEntryId"
                          type="hidden"
                          value={catalogEntry.catalogEntry.entry.id}
                        />
                        <div className="data-grid">
                          <label>
                            <span>Checklist item acknowledgments</span>
                            <textarea
                              className="note-input"
                              defaultValue={formatChecklistItemAcknowledgmentLines(
                                attestation.attestation.items,
                                acknowledgment?.acknowledgment.items,
                              )}
                              name="acknowledgmentItems"
                              placeholder="acknowledged: Validate queued follow-up"
                              rows={4}
                            />
                          </label>
                          <label>
                            <span>Acknowledgment note</span>
                            <input
                              defaultValue={
                                acknowledgment?.acknowledgment
                                  .acknowledgmentNote ?? ""
                              }
                              name="acknowledgmentNote"
                              placeholder="Optional thin acknowledgment note"
                              type="text"
                            />
                          </label>
                        </div>
                        <div className="row spread">
                          <div />
                          <button type="submit">
                            {acknowledgment
                              ? "Update acknowledgments"
                              : "Save acknowledgments"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                    {acknowledgment ? (
                      <form
                        action="/runs/catalog"
                        className="decision-form"
                        method="post"
                      >
                        <input
                          name="returnTo"
                          type="hidden"
                          value={buildCatalogEntryHref(
                            catalogEntry.catalogEntry.entry.id,
                          )}
                        />
                        <input name="intent" type="hidden" value="sign-off" />
                        <input
                          name="catalogEntryId"
                          type="hidden"
                          value={catalogEntry.catalogEntry.entry.id}
                        />
                        <div className="data-grid">
                          <label>
                            <span>Checklist item sign-offs</span>
                            <textarea
                              className="note-input"
                              defaultValue={formatChecklistItemSignoffLines(
                                acknowledgment.acknowledgment.items,
                                signoff?.signoff.items,
                              )}
                              name="signoffItems"
                              placeholder="signed-off: Validate queued follow-up"
                              rows={4}
                            />
                          </label>
                          <label>
                            <span>Sign-off note</span>
                            <input
                              defaultValue={signoff?.signoff.signoffNote ?? ""}
                              name="signoffNote"
                              placeholder="Optional thin sign-off note"
                              type="text"
                            />
                          </label>
                        </div>
                        <div className="row spread">
                          <div />
                          <button type="submit">
                            {signoff ? "Update sign-offs" : "Save sign-offs"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                    {signoff ? (
                      <form
                        action="/runs/catalog"
                        className="decision-form"
                        method="post"
                      >
                        <input
                          name="returnTo"
                          type="hidden"
                          value={buildCatalogEntryHref(
                            catalogEntry.catalogEntry.entry.id,
                          )}
                        />
                        <input
                          name="intent"
                          type="hidden"
                          value="record-exception"
                        />
                        <input
                          name="catalogEntryId"
                          type="hidden"
                          value={catalogEntry.catalogEntry.entry.id}
                        />
                        <div className="data-grid">
                          <label>
                            <span>Checklist item exceptions</span>
                            <textarea
                              className="note-input"
                              defaultValue={formatChecklistItemExceptionLines(
                                signoff.signoff.items,
                                exception?.exception.items,
                              )}
                              name="exceptionItems"
                              placeholder="excepted: Validate queued follow-up"
                              rows={4}
                            />
                          </label>
                          <label>
                            <span>Exception note</span>
                            <input
                              defaultValue={
                                exception?.exception.exceptionNote ?? ""
                              }
                              name="exceptionNote"
                              placeholder="Optional thin exception note"
                              type="text"
                            />
                          </label>
                        </div>
                        <div className="row spread">
                          <div />
                          <button type="submit">
                            {exception
                              ? "Update exceptions"
                              : "Save exceptions"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                    <div className="row spread">
                      <a
                        className="link-button"
                        href={buildCatalogEntryHref(
                          catalogEntry.catalogEntry.entry.id,
                        )}
                      >
                        Apply catalog entry
                      </a>
                      <div className="row">
                        {reviewSignal ? (
                          <form
                            action="/runs/catalog"
                            className="action-form"
                            method="post"
                          >
                            <input
                              name="returnTo"
                              type="hidden"
                              value={buildCatalogEntryHref(
                                catalogEntry.catalogEntry.entry.id,
                              )}
                            />
                            <input
                              name="intent"
                              type="hidden"
                              value="clear-review"
                            />
                            <input
                              name="catalogEntryId"
                              type="hidden"
                              value={catalogEntry.catalogEntry.entry.id}
                            />
                            <button type="submit">Clear review</button>
                          </form>
                        ) : null}
                        {assignment ? (
                          <form
                            action="/runs/catalog"
                            className="action-form"
                            method="post"
                          >
                            <input
                              name="returnTo"
                              type="hidden"
                              value={buildCatalogEntryHref(
                                catalogEntry.catalogEntry.entry.id,
                              )}
                            />
                            <input
                              name="intent"
                              type="hidden"
                              value="clear-assignment"
                            />
                            <input
                              name="catalogEntryId"
                              type="hidden"
                              value={catalogEntry.catalogEntry.entry.id}
                            />
                            <button type="submit">Clear assignment</button>
                          </form>
                        ) : null}
                        {checklist ? (
                          <form
                            action="/runs/catalog"
                            className="action-form"
                            method="post"
                          >
                            <input
                              name="returnTo"
                              type="hidden"
                              value={buildCatalogEntryHref(
                                catalogEntry.catalogEntry.entry.id,
                              )}
                            />
                            <input
                              name="intent"
                              type="hidden"
                              value="clear-checklist"
                            />
                            <input
                              name="catalogEntryId"
                              type="hidden"
                              value={catalogEntry.catalogEntry.entry.id}
                            />
                            <button type="submit">Clear checklist</button>
                          </form>
                        ) : null}
                        {progress ? (
                          <form
                            action="/runs/catalog"
                            className="action-form"
                            method="post"
                          >
                            <input
                              name="returnTo"
                              type="hidden"
                              value={buildCatalogEntryHref(
                                catalogEntry.catalogEntry.entry.id,
                              )}
                            />
                            <input
                              name="intent"
                              type="hidden"
                              value="clear-progress"
                            />
                            <input
                              name="catalogEntryId"
                              type="hidden"
                              value={catalogEntry.catalogEntry.entry.id}
                            />
                            <button type="submit">Clear progress</button>
                          </form>
                        ) : null}
                        {blocker ? (
                          <form
                            action="/runs/catalog"
                            className="action-form"
                            method="post"
                          >
                            <input
                              name="returnTo"
                              type="hidden"
                              value={buildCatalogEntryHref(
                                catalogEntry.catalogEntry.entry.id,
                              )}
                            />
                            <input
                              name="intent"
                              type="hidden"
                              value="clear-blocker"
                            />
                            <input
                              name="catalogEntryId"
                              type="hidden"
                              value={catalogEntry.catalogEntry.entry.id}
                            />
                            <button type="submit">Clear blockers</button>
                          </form>
                        ) : null}
                        {resolution ? (
                          <form
                            action="/runs/catalog"
                            className="action-form"
                            method="post"
                          >
                            <input
                              name="returnTo"
                              type="hidden"
                              value={buildCatalogEntryHref(
                                catalogEntry.catalogEntry.entry.id,
                              )}
                            />
                            <input
                              name="intent"
                              type="hidden"
                              value="clear-resolution"
                            />
                            <input
                              name="catalogEntryId"
                              type="hidden"
                              value={catalogEntry.catalogEntry.entry.id}
                            />
                            <button type="submit">Clear resolutions</button>
                          </form>
                        ) : null}
                        {verification ? (
                          <form
                            action="/runs/catalog"
                            className="action-form"
                            method="post"
                          >
                            <input
                              name="returnTo"
                              type="hidden"
                              value={buildCatalogEntryHref(
                                catalogEntry.catalogEntry.entry.id,
                              )}
                            />
                            <input
                              name="intent"
                              type="hidden"
                              value="clear-verification"
                            />
                            <input
                              name="catalogEntryId"
                              type="hidden"
                              value={catalogEntry.catalogEntry.entry.id}
                            />
                            <button type="submit">Clear verifications</button>
                          </form>
                        ) : null}
                        {evidence ? (
                          <form
                            action="/runs/catalog"
                            className="action-form"
                            method="post"
                          >
                            <input
                              name="returnTo"
                              type="hidden"
                              value={buildCatalogEntryHref(
                                catalogEntry.catalogEntry.entry.id,
                              )}
                            />
                            <input
                              name="intent"
                              type="hidden"
                              value="clear-evidence"
                            />
                            <input
                              name="catalogEntryId"
                              type="hidden"
                              value={catalogEntry.catalogEntry.entry.id}
                            />
                            <button type="submit">Clear evidence</button>
                          </form>
                        ) : null}
                        {attestation ? (
                          <form
                            action="/runs/catalog"
                            className="action-form"
                            method="post"
                          >
                            <input
                              name="returnTo"
                              type="hidden"
                              value={buildCatalogEntryHref(
                                catalogEntry.catalogEntry.entry.id,
                              )}
                            />
                            <input
                              name="intent"
                              type="hidden"
                              value="clear-attestation"
                            />
                            <input
                              name="catalogEntryId"
                              type="hidden"
                              value={catalogEntry.catalogEntry.entry.id}
                            />
                            <button type="submit">Clear attestations</button>
                          </form>
                        ) : null}
                        {acknowledgment ? (
                          <form
                            action="/runs/catalog"
                            className="action-form"
                            method="post"
                          >
                            <input
                              name="returnTo"
                              type="hidden"
                              value={buildCatalogEntryHref(
                                catalogEntry.catalogEntry.entry.id,
                              )}
                            />
                            <input
                              name="intent"
                              type="hidden"
                              value="clear-acknowledgment"
                            />
                            <input
                              name="catalogEntryId"
                              type="hidden"
                              value={catalogEntry.catalogEntry.entry.id}
                            />
                            <button type="submit">Clear acknowledgments</button>
                          </form>
                        ) : null}
                        <form
                          action="/runs/catalog"
                          className="action-form"
                          method="post"
                        >
                          <input
                            name="returnTo"
                            type="hidden"
                            value={buildCatalogEntryHref(
                              catalogEntry.catalogEntry.entry.id,
                            )}
                          />
                          <input
                            name="catalogEntryId"
                            type="hidden"
                            value={catalogEntry.catalogEntry.entry.id}
                          />
                          <input
                            name="intent"
                            type="hidden"
                            value={
                              catalogEntry.visibility.state === "shared"
                                ? "unshare"
                                : "share"
                            }
                          />
                          <button type="submit">
                            {catalogEntry.visibility.state === "shared"
                              ? "Make personal"
                              : "Share in scope"}
                          </button>
                        </form>
                        <form
                          action="/runs/catalog"
                          className="action-form"
                          method="post"
                        >
                          <input
                            name="returnTo"
                            type="hidden"
                            value={buildCatalogEntryHref(
                              catalogEntry.catalogEntry.entry.id,
                            )}
                          />
                          <input name="intent" type="hidden" value="archive" />
                          <input
                            name="catalogEntryId"
                            type="hidden"
                            value={catalogEntry.catalogEntry.entry.id}
                          />
                          <button type="submit">Archive</button>
                        </form>
                      </div>
                    </div>
                    {activeCatalogEntry?.catalogEntry.entry.id ===
                    catalogEntry.catalogEntry.entry.id ? (
                      <div className="timeline-meta">Currently applied</div>
                    ) : null}
                    {activeCatalogChecklistItemProgress?.checklist.assignment
                      .review.visibility.catalogEntry.entry.id ===
                    catalogEntry.catalogEntry.entry.id ? (
                      <div className="timeline-meta">
                        Active progress selected
                      </div>
                    ) : null}
                    {activeCatalogChecklistItemBlocker?.progress.checklist
                      .assignment.review.visibility.catalogEntry.entry.id ===
                    catalogEntry.catalogEntry.entry.id ? (
                      <div className="timeline-meta">
                        Active blockers selected
                      </div>
                    ) : null}
                    {activeCatalogChecklistItemResolution?.blocker.progress
                      .checklist.assignment.review.visibility.catalogEntry.entry
                      .id === catalogEntry.catalogEntry.entry.id ? (
                      <div className="timeline-meta">
                        Active resolutions selected
                      </div>
                    ) : null}
                    {activeCatalogChecklistItemVerification?.resolution.blocker
                      .progress.checklist.assignment.review.visibility
                      .catalogEntry.entry.id ===
                    catalogEntry.catalogEntry.entry.id ? (
                      <div className="timeline-meta">
                        Active verifications selected
                      </div>
                    ) : null}
                    {activeCatalogChecklistItemEvidence?.verification.resolution
                      .blocker.progress.checklist.assignment.review.visibility
                      .catalogEntry.entry.id ===
                    catalogEntry.catalogEntry.entry.id ? (
                      <div className="timeline-meta">
                        Active evidence selected
                      </div>
                    ) : null}
                    {activeCatalogChecklistItemAttestation?.evidence
                      .verification.resolution.blocker.progress.checklist
                      .assignment.review.visibility.catalogEntry.entry.id ===
                    catalogEntry.catalogEntry.entry.id ? (
                      <div className="timeline-meta">
                        Active attestations selected
                      </div>
                    ) : null}
                    {activeCatalogChecklistItemAcknowledgment?.attestation
                      .evidence.verification.resolution.blocker.progress
                      .checklist.assignment.review.visibility.catalogEntry.entry
                      .id === catalogEntry.catalogEntry.entry.id ? (
                      <div className="timeline-meta">
                        Active acknowledgments selected
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function SavedAuditViewsView({
  activeSavedView,
  navigation,
  savedViews,
}: Readonly<{
  activeSavedView?: ApiAuditSavedView;
  navigation: ApiAuditNavigationView;
  savedViews: ApiAuditSavedViewCollection;
}>) {
  const returnTo = activeSavedView
    ? buildSavedAuditViewHref(activeSavedView.id)
    : buildAuditNavigationPageHref(
        navigation.filters.summary,
        navigation.filters.drilldown,
      );

  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">Phase 15 / Saved Audit Views</div>
          <h2>Saved audit views</h2>
          <p className="empty-copy">
            Save constrained audit navigation state without snapshotting audit
            facts or turning the web console into a catalog product.
          </p>
        </div>
        <div className="timeline-count">
          {savedViews.totalCount} saved view(s)
        </div>
      </div>

      {activeSavedView ? (
        <div className="inline-note">
          Applying <strong>{activeSavedView.name}</strong> (
          {activeSavedView.kind}
          ).
          <a className="subtle-link" href="/runs">
            Clear saved view
          </a>
        </div>
      ) : null}

      <form action="/runs/saved-views" className="decision-form" method="post">
        <input name="returnTo" type="hidden" value={returnTo} />
        <HiddenField
          name="summaryDefinitionId"
          value={navigation.filters.summary.definitionId}
        />
        <HiddenField
          name="summaryRunStatus"
          value={navigation.filters.summary.runStatus}
        />
        <HiddenField
          name="summaryExecutionMode"
          value={navigation.filters.summary.executionMode}
        />
        <HiddenField
          name="summaryToolName"
          value={navigation.filters.summary.toolName}
        />
        <HiddenField
          name="drilldownApprovalId"
          value={navigation.filters.drilldown.approvalId}
        />
        <HiddenField
          name="drilldownDispatchJobId"
          value={navigation.filters.drilldown.dispatchJobId}
        />
        <HiddenField
          name="drilldownRunId"
          value={navigation.filters.drilldown.runId}
        />
        <HiddenField
          name="drilldownStepId"
          value={navigation.filters.drilldown.stepId}
        />
        <HiddenField
          name="drilldownToolCallId"
          value={navigation.filters.drilldown.toolCallId}
        />
        <HiddenField
          name="drilldownToolId"
          value={navigation.filters.drilldown.toolId}
        />
        <HiddenField
          name="drilldownWorkerId"
          value={navigation.filters.drilldown.workerId}
        />
        <div className="data-grid">
          <label>
            <span>Name</span>
            <input
              name="name"
              placeholder="Queued worker follow-up"
              type="text"
            />
          </label>
          <label>
            <span>Description</span>
            <input
              name="description"
              placeholder="Saved operator preset for constrained audit follow-up"
              type="text"
            />
          </label>
        </div>
        <div className="row spread">
          <div className="decision-actions">
            <button type="submit">Save current view</button>
            <a className="subtle-link" href={returnTo}>
              Keep current filters
            </a>
          </div>
        </div>
      </form>

      {savedViews.items.length === 0 ? (
        <p className="empty-copy">
          No saved audit views yet. Save a constrained navigation state to
          reopen it later through the same operator seam.
        </p>
      ) : (
        <ol className="timeline-list">
          {savedViews.items.map((savedView) => (
            <li className="timeline-entry" key={savedView.id}>
              <div className="row spread">
                <div>
                  <strong>{savedView.name}</strong>
                  <div className="timeline-meta">{savedView.kind}</div>
                </div>
                <span>{formatTimestamp(savedView.updatedAt)}</span>
              </div>
              {savedView.description ? (
                <p className="empty-copy">{savedView.description}</p>
              ) : null}
              <div className="timeline-meta">
                summary filters{" "}
                {countSavedViewSummaryFilters(savedView.navigation.summary)}
                {savedView.refs.auditViewRunId
                  ? ` · audit view ${savedView.refs.auditViewRunId}`
                  : ""}
                {savedView.refs.drilldownRunId
                  ? ` · drilldown ${savedView.refs.drilldownRunId}`
                  : ""}
              </div>
              <div className="timeline-meta">
                drilldown filters{" "}
                {countSavedViewDrilldownFilters(savedView.navigation.drilldown)}
              </div>
              <div className="row spread">
                <a
                  className="link-button"
                  href={buildSavedAuditViewHref(savedView.id)}
                >
                  Apply saved view
                </a>
                <div className="row">
                  <form
                    action="/runs/catalog"
                    className="action-form"
                    method="post"
                  >
                    <input name="intent" type="hidden" value="publish" />
                    <input
                      name="savedViewId"
                      type="hidden"
                      value={savedView.id}
                    />
                    <button type="submit">Publish to catalog</button>
                  </form>
                  {activeSavedView?.id === savedView.id ? (
                    <span className="subtle-link">Currently applied</span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function CrossRunAuditNavigationView({
  navigation,
}: Readonly<{
  navigation: ApiAuditNavigationView;
}>) {
  const summaryFilters = navigation.filters.summary;
  const drilldownFilters = navigation.filters.drilldown;

  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">Phase 14 / Audit Navigation</div>
          <h2>Cross-run audit navigation</h2>
          <p className="empty-copy">
            Thin linked operator views over summaries, drilldowns, and the
            existing run-scoped audit seam.
          </p>
        </div>
        <div className="timeline-count">
          {navigation.totalSummaryCount} summary result(s)
        </div>
      </div>

      <form action="/runs" className="decision-form" method="get">
        <div className="data-grid">
          <label>
            <span>Definition ID</span>
            <input
              defaultValue={summaryFilters.definitionId ?? ""}
              name="auditDefinitionId"
              placeholder="shell-runbook-flow"
              type="text"
            />
          </label>
          <label>
            <span>Run status</span>
            <select
              defaultValue={summaryFilters.runStatus ?? ""}
              name="auditStatus"
            >
              <option value="">all</option>
              <option value="pending">pending</option>
              <option value="queued">queued</option>
              <option value="running">running</option>
              <option value="paused">paused</option>
              <option value="succeeded">succeeded</option>
              <option value="failed">failed</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>
          <label>
            <span>Execution mode</span>
            <select
              defaultValue={summaryFilters.executionMode ?? ""}
              name="auditExecutionMode"
            >
              <option value="">all</option>
              <option value="inline">inline</option>
              <option value="queued">queued</option>
            </select>
          </label>
          <label>
            <span>Tool name</span>
            <input
              defaultValue={summaryFilters.toolName ?? ""}
              name="auditToolName"
              placeholder="shell.runbook"
              type="text"
            />
          </label>
        </div>
        <div className="data-grid">
          <label>
            <span>Run ID</span>
            <input
              defaultValue={drilldownFilters.runId ?? ""}
              name="drilldownRunId"
              placeholder="run_1"
              type="text"
            />
          </label>
          <label>
            <span>Approval ID</span>
            <input
              defaultValue={drilldownFilters.approvalId ?? ""}
              name="drilldownApprovalId"
              placeholder="approval_1"
              type="text"
            />
          </label>
          <label>
            <span>Step ID</span>
            <input
              defaultValue={drilldownFilters.stepId ?? ""}
              name="drilldownStepId"
              placeholder="step_review"
              type="text"
            />
          </label>
          <label>
            <span>Dispatch Job ID</span>
            <input
              defaultValue={drilldownFilters.dispatchJobId ?? ""}
              name="drilldownDispatchJobId"
              placeholder="dispatch_1"
              type="text"
            />
          </label>
          <label>
            <span>Worker ID</span>
            <input
              defaultValue={drilldownFilters.workerId ?? ""}
              name="drilldownWorkerId"
              placeholder="worker_1"
              type="text"
            />
          </label>
          <label>
            <span>Tool Call ID</span>
            <input
              defaultValue={drilldownFilters.toolCallId ?? ""}
              name="drilldownToolCallId"
              placeholder="call_1"
              type="text"
            />
          </label>
          <label>
            <span>Tool ID</span>
            <input
              defaultValue={drilldownFilters.toolId ?? ""}
              name="drilldownToolId"
              placeholder="builtin.shell.runbook"
              type="text"
            />
          </label>
        </div>
        <div className="row spread">
          <div className="decision-actions">
            <button type="submit">Apply navigation</button>
            <a className="subtle-link" href="/runs">
              Clear navigation
            </a>
          </div>
          <div className="timeline-count">
            {navigation.totalMatchedEntryCount} matched drilldown fact(s)
          </div>
        </div>
      </form>

      {navigation.summaries.length === 0 ? (
        <p className="empty-copy">
          No cross-run audit summaries matched the current navigation filters.
        </p>
      ) : (
        <ol className="timeline-list">
          {navigation.summaries.map((summary) => (
            <li className="timeline-entry" key={summary.result.runId}>
              <div className="row spread">
                <div>
                  <strong>{summary.result.definitionName}</strong>
                  <div className="timeline-meta">
                    run {summary.result.runId}
                  </div>
                </div>
                <StatusBadge status={summary.result.runStatus} />
              </div>
              <div className="timeline-meta">
                updated {formatTimestamp(summary.result.updatedAt)}
                {summary.result.lastOccurredAt
                  ? ` · last fact ${formatTimestamp(summary.result.lastOccurredAt)}`
                  : ""}
              </div>
              <div className="timeline-meta">
                execution {joinOrFallback(summary.result.executionModes, "n/a")}
                {summary.result.workerIds.length > 0
                  ? ` · workers ${joinOrFallback(summary.result.workerIds, "n/a")}`
                  : ""}
              </div>
              <p className="empty-copy">{summary.result.summary}</p>
              <div className="timeline-meta">
                {summary.links.drilldowns.length > 0 ? (
                  <>
                    drilldowns:{" "}
                    {summary.links.drilldowns.map((link, index) => (
                      <span key={`${summary.result.runId}:${link.label}`}>
                        {index > 0 ? " · " : ""}
                        <a
                          className="subtle-link"
                          href={buildNavigationLinkHref(
                            link,
                            navigation.filters.summary,
                          )}
                          title={link.summary}
                        >
                          {link.label}
                        </a>
                      </span>
                    ))}
                  </>
                ) : (
                  "No drilldown pivots available for this summary."
                )}
              </div>
              <div className="row spread">
                <a
                  className="link-button"
                  href={buildNavigationLinkHref(
                    summary.links.auditView,
                    navigation.filters.summary,
                  )}
                  title={summary.links.auditView.summary}
                >
                  Open run audit view
                </a>
                <a
                  className="subtle-link"
                  href={`/runs/${summary.result.runId}/timeline`}
                >
                  Timeline
                </a>
              </div>
            </li>
          ))}
        </ol>
      )}

      {!navigation.isConstrained ? (
        <p className="empty-copy">
          Provide at least one stable identifier to materialize linked
          drilldowns beneath the current summaries.
        </p>
      ) : navigation.drilldowns.length === 0 ? (
        <p className="empty-copy">
          No identifier-driven drilldowns matched the current navigation state.
        </p>
      ) : (
        <ol className="timeline-list">
          {navigation.drilldowns.map((drilldown) => (
            <li className="timeline-entry" key={drilldown.result.runId}>
              <div className="row spread">
                <div>
                  <strong>{drilldown.result.definitionName}</strong>
                  <div className="timeline-meta">
                    run {drilldown.result.runId}
                  </div>
                </div>
                <StatusBadge status={drilldown.result.runStatus} />
              </div>
              <div className="timeline-meta">
                matched {drilldown.result.matchedEntryCount} fact(s)
                {drilldown.result.lastOccurredAt
                  ? ` · last fact ${formatTimestamp(drilldown.result.lastOccurredAt)}`
                  : ""}
              </div>
              <p className="empty-copy">{drilldown.result.summary}</p>
              <ol className="timeline-list">
                {drilldown.result.entries.map((entry) => (
                  <li
                    className="timeline-entry"
                    key={`${drilldown.result.runId}:${readAuditEntryKey(entry)}`}
                  >
                    <div className="row spread">
                      <strong>{entry.summary}</strong>
                      <span>{formatTimestamp(entry.occurredAt)}</span>
                    </div>
                    <div className="timeline-meta">
                      {entry.kind}
                      {entry.correlation.stepId
                        ? ` · step ${entry.correlation.stepId}`
                        : ""}
                      {entry.correlation.dispatchJobId
                        ? ` · dispatch ${entry.correlation.dispatchJobId}`
                        : ""}
                      {entry.correlation.workerId
                        ? ` · worker ${entry.correlation.workerId}`
                        : ""}
                      {entry.correlation.approvalId
                        ? ` · approval ${entry.correlation.approvalId}`
                        : ""}
                      {entry.correlation.toolCallId
                        ? ` · call ${entry.correlation.toolCallId}`
                        : ""}
                      {entry.correlation.toolId
                        ? ` · tool ${entry.correlation.toolId}`
                        : ""}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="row spread">
                <a
                  className="link-button"
                  href={buildNavigationLinkHref(
                    drilldown.links.auditView,
                    navigation.filters.summary,
                  )}
                  title={drilldown.links.auditView.summary}
                >
                  Open run audit view
                </a>
                <a
                  className="subtle-link"
                  href={`/runs/${drilldown.result.runId}/timeline`}
                >
                  Timeline
                </a>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function CrossRunAuditResultsView({
  filters,
  results,
}: Readonly<{
  filters: ApiCrossRunAuditFilters;
  results: ApiCrossRunAuditResults;
}>) {
  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">Phase 12 / Audit Queries</div>
          <h2>Cross-run audit queries</h2>
          <p className="empty-copy">
            Thin operator-facing filters over the shared cross-run audit seam.
          </p>
        </div>
        <div className="timeline-count">{results.totalCount} result(s)</div>
      </div>

      <form action="/runs" className="decision-form" method="get">
        <div className="data-grid">
          <label>
            <span>Definition ID</span>
            <input
              defaultValue={filters.definitionId ?? ""}
              name="auditDefinitionId"
              placeholder="shell-runbook-flow"
              type="text"
            />
          </label>
          <label>
            <span>Run status</span>
            <select defaultValue={filters.runStatus ?? ""} name="auditStatus">
              <option value="">all</option>
              <option value="pending">pending</option>
              <option value="queued">queued</option>
              <option value="running">running</option>
              <option value="paused">paused</option>
              <option value="succeeded">succeeded</option>
              <option value="failed">failed</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>
          <label>
            <span>Execution mode</span>
            <select
              defaultValue={filters.executionMode ?? ""}
              name="auditExecutionMode"
            >
              <option value="">all</option>
              <option value="inline">inline</option>
              <option value="queued">queued</option>
            </select>
          </label>
          <label>
            <span>Tool name</span>
            <input
              defaultValue={filters.toolName ?? ""}
              name="auditToolName"
              placeholder="shell.runbook"
              type="text"
            />
          </label>
        </div>
        <div className="row spread">
          <div className="decision-actions">
            <button type="submit">Apply filters</button>
            <a className="subtle-link" href="/runs">
              Clear filters
            </a>
          </div>
        </div>
      </form>

      {results.results.length === 0 ? (
        <p className="empty-copy">
          No cross-run audit results matched the current filters.
        </p>
      ) : (
        <ol className="timeline-list">
          {results.results.map((result) => (
            <li className="timeline-entry" key={result.runId}>
              <div className="row spread">
                <div>
                  <strong>{result.definitionName}</strong>
                  <div className="timeline-meta">run {result.runId}</div>
                </div>
                <StatusBadge status={result.runStatus} />
              </div>
              <div className="timeline-meta">
                updated {formatTimestamp(result.updatedAt)}
                {result.lastOccurredAt
                  ? ` · last fact ${formatTimestamp(result.lastOccurredAt)}`
                  : ""}
              </div>
              <div className="timeline-meta">
                execution {joinOrFallback(result.executionModes, "n/a")}
                {result.workerIds.length > 0
                  ? ` · workers ${joinOrFallback(result.workerIds, "n/a")}`
                  : ""}
              </div>
              <div className="timeline-meta">
                approvals {result.approvals.length}
                {result.dispatchJobs.length > 0
                  ? ` · dispatch ${result.dispatchJobs.length}`
                  : ""}
                {result.toolCalls.length > 0
                  ? ` · tools ${joinOrFallback(
                      result.toolCalls.map((tool) => tool.toolName),
                      "n/a",
                    )}`
                  : ""}
              </div>
              <p className="empty-copy">{result.summary}</p>
              <div className="row spread">
                <a className="link-button" href={`/runs/${result.runId}`}>
                  Open run detail
                </a>
                <div className="row">
                  <a
                    className="subtle-link"
                    href={buildAuditDrilldownHref({
                      runId: result.runId,
                    })}
                  >
                    Drill down
                  </a>
                  <a
                    className="subtle-link"
                    href={`/runs/${result.runId}/timeline`}
                  >
                    Timeline
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function CrossRunAuditDrilldownsView({
  filters,
  results,
}: Readonly<{
  filters: ApiCrossRunAuditDrilldownFilters;
  results: ApiCrossRunAuditDrilldownResults;
}>) {
  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">Phase 13 / Audit Drilldowns</div>
          <h2>Cross-run audit drilldowns</h2>
          <p className="empty-copy">
            Thin operator-facing drilldowns constrained by stable identifiers.
          </p>
        </div>
        <div className="timeline-count">
          {results.totalMatchedEntryCount} matched fact(s)
        </div>
      </div>

      <form action="/runs" className="decision-form" method="get">
        <div className="data-grid">
          <label>
            <span>Run ID</span>
            <input
              defaultValue={filters.runId ?? ""}
              name="drilldownRunId"
              placeholder="run_1"
              type="text"
            />
          </label>
          <label>
            <span>Approval ID</span>
            <input
              defaultValue={filters.approvalId ?? ""}
              name="drilldownApprovalId"
              placeholder="approval_1"
              type="text"
            />
          </label>
          <label>
            <span>Step ID</span>
            <input
              defaultValue={filters.stepId ?? ""}
              name="drilldownStepId"
              placeholder="step_review"
              type="text"
            />
          </label>
          <label>
            <span>Dispatch Job ID</span>
            <input
              defaultValue={filters.dispatchJobId ?? ""}
              name="drilldownDispatchJobId"
              placeholder="dispatch_1"
              type="text"
            />
          </label>
          <label>
            <span>Worker ID</span>
            <input
              defaultValue={filters.workerId ?? ""}
              name="drilldownWorkerId"
              placeholder="worker_1"
              type="text"
            />
          </label>
          <label>
            <span>Tool Call ID</span>
            <input
              defaultValue={filters.toolCallId ?? ""}
              name="drilldownToolCallId"
              placeholder="call_1"
              type="text"
            />
          </label>
          <label>
            <span>Tool ID</span>
            <input
              defaultValue={filters.toolId ?? ""}
              name="drilldownToolId"
              placeholder="builtin.shell.runbook"
              type="text"
            />
          </label>
        </div>
        <div className="row spread">
          <div className="decision-actions">
            <button type="submit">Apply drilldown</button>
            <a className="subtle-link" href="/runs">
              Clear drilldown
            </a>
          </div>
        </div>
      </form>

      {!results.isConstrained ? (
        <p className="empty-copy">
          Provide at least one stable identifier to narrow cross-run audit
          facts.
        </p>
      ) : results.results.length === 0 ? (
        <p className="empty-copy">
          No audit drilldown results matched the current identifiers.
        </p>
      ) : (
        <ol className="timeline-list">
          {results.results.map((result) => (
            <li className="timeline-entry" key={result.runId}>
              <div className="row spread">
                <div>
                  <strong>{result.definitionName}</strong>
                  <div className="timeline-meta">run {result.runId}</div>
                </div>
                <StatusBadge status={result.runStatus} />
              </div>
              <div className="timeline-meta">
                updated {formatTimestamp(result.updatedAt)}
                {result.lastOccurredAt
                  ? ` · last fact ${formatTimestamp(result.lastOccurredAt)}`
                  : ""}
              </div>
              <div className="timeline-meta">
                approvals{" "}
                {joinOrFallback(result.identifiers.approvalIds, "n/a")}
                {result.identifiers.dispatchJobIds.length > 0
                  ? ` · dispatch ${joinOrFallback(
                      result.identifiers.dispatchJobIds,
                      "n/a",
                    )}`
                  : ""}
                {result.identifiers.workerIds.length > 0
                  ? ` · workers ${joinOrFallback(
                      result.identifiers.workerIds,
                      "n/a",
                    )}`
                  : ""}
              </div>
              <div className="timeline-meta">
                steps {joinOrFallback(result.identifiers.stepIds, "n/a")}
                {result.identifiers.toolIds.length > 0
                  ? ` · tools ${joinOrFallback(
                      result.identifiers.toolIds,
                      "n/a",
                    )}`
                  : ""}
              </div>
              <p className="empty-copy">{result.summary}</p>
              <ol className="timeline-list">
                {result.entries.map((entry) => (
                  <li
                    className="timeline-entry"
                    key={`${result.runId}:${readAuditEntryKey(entry)}`}
                  >
                    <div className="row spread">
                      <strong>{entry.summary}</strong>
                      <span>{formatTimestamp(entry.occurredAt)}</span>
                    </div>
                    <div className="timeline-meta">
                      {entry.kind}
                      {entry.correlation.stepId
                        ? ` · step ${entry.correlation.stepId}`
                        : ""}
                      {entry.correlation.dispatchJobId
                        ? ` · dispatch ${entry.correlation.dispatchJobId}`
                        : ""}
                      {entry.correlation.workerId
                        ? ` · worker ${entry.correlation.workerId}`
                        : ""}
                      {entry.correlation.approvalId
                        ? ` · approval ${entry.correlation.approvalId}`
                        : ""}
                      {entry.correlation.toolCallId
                        ? ` · call ${entry.correlation.toolCallId}`
                        : ""}
                      {entry.correlation.toolId
                        ? ` · tool ${entry.correlation.toolId}`
                        : ""}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="row spread">
                <a className="link-button" href={`/runs/${result.runId}`}>
                  Open run detail
                </a>
                <a
                  className="subtle-link"
                  href={`/runs/${result.runId}/timeline`}
                >
                  Timeline
                </a>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function RunDetailView({
  audit,
  approvals,
  run,
  toolHistory,
  timeline,
}: Readonly<{
  audit: ApiAuditView;
  approvals: readonly ApiApproval[];
  run: ApiRun;
  toolHistory: readonly ApiToolHistoryEntry[];
  timeline: ApiTimeline;
}>) {
  const latestApproval = approvals.at(-1);
  const pendingApproval = approvals.find(
    (approval) => approval.status === "pending",
  );
  const recentAuditEntries = [...audit.entries].slice(-6).reverse();
  const recentEntries = timeline.entries.slice(-5).reverse();
  const recentToolHistory = [...toolHistory].slice(-5).reverse();

  return (
    <section className="detail-grid">
      <article className="card">
        <div className="row spread">
          <div>
            <div className="card-eyebrow">{run.definitionId}</div>
            <h2>{run.definitionName}</h2>
          </div>
          <StatusBadge status={run.status} />
        </div>
        <dl className="data-grid">
          <MetadataRow label="Run ID" value={run.id} />
          <MetadataRow label="Created" value={formatTimestamp(run.createdAt)} />
          <MetadataRow label="Updated" value={formatTimestamp(run.updatedAt)} />
          <MetadataRow label="Version" value={run.definitionVersion} />
          <MetadataRow
            label="Approval"
            value={latestApproval ? latestApproval.status : "none"}
          />
          <MetadataRow label="Pause reason" value={run.pauseReason ?? "none"} />
        </dl>

        {pendingApproval ? (
          <div className="inline-note">
            This run is waiting for approval{" "}
            <a href="/approvals">in the approval queue</a>.
          </div>
        ) : null}

        {run.status === "paused" && !pendingApproval ? (
          <form
            action={`/runs/${run.id}/resume`}
            className="action-form"
            method="post"
          >
            <input name="returnTo" type="hidden" value={`/runs/${run.id}`} />
            <button type="submit">Resume run</button>
          </form>
        ) : null}
      </article>

      <article className="card">
        <div className="row spread">
          <h3>Replay summary</h3>
          <a className="subtle-link" href={`/runs/${run.id}/timeline`}>
            Open full timeline
          </a>
        </div>
        <TimelineEntries entries={recentEntries} />
      </article>

      <article className="card">
        <h3>Approval snapshots</h3>
        {approvals.length === 0 ? (
          <p className="empty-copy">This run has not created any approvals.</p>
        ) : (
          <ul className="approval-history">
            {approvals
              .slice()
              .reverse()
              .map((approval) => (
                <li key={approval.id}>
                  <div className="row spread">
                    <strong>{approval.id}</strong>
                    <StatusBadge status={approval.status} />
                  </div>
                  <p>
                    requested {formatTimestamp(approval.requestedAt)}
                    {approval.decidedAt
                      ? `, decided ${formatTimestamp(approval.decidedAt)}`
                      : ""}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </article>

      <article className="card">
        <h3>Tool history</h3>
        {recentToolHistory.length === 0 ? (
          <p className="empty-copy">
            No persisted tool history has been recorded for this run yet.
          </p>
        ) : (
          <ol className="timeline-list">
            {recentToolHistory.map((entry) => (
              <li className="timeline-entry" key={entry.callId}>
                <div className="row spread">
                  <strong>{entry.toolName}</strong>
                  <StatusBadge status={entry.outcome} />
                </div>
                <div className="timeline-meta">
                  call {entry.callId}
                  {entry.stepId ? ` · step ${entry.stepId}` : ""}
                  {entry.dispatchJobId
                    ? ` · dispatch ${entry.dispatchJobId}`
                    : ""}
                  {entry.workerId ? ` · worker ${entry.workerId}` : ""}
                </div>
                <div className="timeline-meta">
                  {formatTimestamp(entry.startedAt)} to{" "}
                  {formatTimestamp(entry.finishedAt)}
                </div>
                <pre className="payload-preview">
                  {JSON.stringify(
                    {
                      input: entry.inputSummary,
                      ...(entry.outputSummary
                        ? { output: entry.outputSummary }
                        : {}),
                      ...(entry.outcomeDetail
                        ? { detail: entry.outcomeDetail }
                        : {}),
                      source: entry.source,
                    },
                    null,
                    2,
                  )}
                </pre>
              </li>
            ))}
          </ol>
        )}
      </article>

      <article className="card">
        <h3>Audit view</h3>
        {recentAuditEntries.length === 0 ? (
          <p className="empty-copy">
            No correlated audit facts have been projected for this run yet.
          </p>
        ) : (
          <ol className="timeline-list">
            {recentAuditEntries.map((entry) => (
              <li className="timeline-entry" key={readAuditEntryKey(entry)}>
                <div className="row spread">
                  <strong>{entry.summary}</strong>
                  <span>{formatTimestamp(entry.occurredAt)}</span>
                </div>
                <div className="timeline-meta">
                  {entry.kind}
                  {entry.correlation.stepId
                    ? ` · step ${entry.correlation.stepId}`
                    : ""}
                  {entry.correlation.dispatchJobId
                    ? ` · dispatch ${entry.correlation.dispatchJobId}`
                    : ""}
                  {entry.correlation.workerId
                    ? ` · worker ${entry.correlation.workerId}`
                    : ""}
                  {entry.correlation.approvalId
                    ? ` · approval ${entry.correlation.approvalId}`
                    : ""}
                </div>
                <div className="timeline-meta">
                  source {entry.fact.sourceOfTruth}
                  {entry.correlation.toolCallId
                    ? ` · call ${entry.correlation.toolCallId}`
                    : ""}
                  {entry.correlation.toolId
                    ? ` · tool ${entry.correlation.toolId}`
                    : ""}
                </div>
                {entry.detail ? (
                  <pre className="payload-preview">
                    {JSON.stringify({ detail: entry.detail }, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </article>
    </section>
  );
}

export function ApprovalQueueView({
  items,
}: Readonly<{
  items: readonly PendingApprovalSummary[];
}>) {
  if (items.length === 0) {
    return (
      <section className="card empty-state">
        <h2>No pending approvals</h2>
        <p>Approval decisions will appear here when a run pauses for review.</p>
      </section>
    );
  }

  return (
    <section className="list-grid">
      {items.map(({ approval, run }) => (
        <article className="card" key={approval.id}>
          <div className="row spread">
            <div>
              <div className="card-eyebrow">{run.definitionId}</div>
              <h2>{run.definitionName}</h2>
            </div>
            <StatusBadge status={approval.status} />
          </div>
          <dl className="data-grid">
            <MetadataRow label="Approval ID" value={approval.id} />
            <MetadataRow label="Run ID" value={run.id} />
            <MetadataRow
              label="Requested"
              value={formatTimestamp(approval.requestedAt)}
            />
            <MetadataRow
              label="Reviewer"
              value={approval.reviewer?.id ?? "unassigned"}
            />
          </dl>
          {approval.note ? (
            <p className="inline-note">{approval.note}</p>
          ) : null}
          <form
            action={`/approvals/${approval.id}/decision`}
            className="decision-form"
            method="post"
          >
            <input name="returnTo" type="hidden" value="/approvals" />
            <input name="actorId" type="hidden" value="web-console" />
            <input
              name="actorDisplayName"
              type="hidden"
              value="Runroot Web Console"
            />
            <textarea
              className="note-input"
              name="note"
              placeholder="Optional operator note"
              rows={3}
            />
            <div className="decision-actions">
              <button name="decision" type="submit" value="approved">
                Approve
              </button>
              <button name="decision" type="submit" value="rejected">
                Reject
              </button>
              <button name="decision" type="submit" value="cancelled">
                Cancel
              </button>
            </div>
          </form>
          <div className="row spread">
            <a className="subtle-link" href={`/runs/${run.id}`}>
              Open run detail
            </a>
            <a className="subtle-link" href={`/runs/${run.id}/timeline`}>
              Timeline
            </a>
          </div>
        </article>
      ))}
    </section>
  );
}

export function TimelineView({
  runId,
  timeline,
}: Readonly<{
  runId: string;
  timeline: ApiTimeline;
}>) {
  return (
    <section className="card">
      <div className="row spread">
        <div>
          <div className="card-eyebrow">Replay source of truth</div>
          <h2>Timeline for {runId}</h2>
        </div>
        <div className="timeline-count">{timeline.entries.length} entries</div>
      </div>
      <TimelineEntries entries={[...timeline.entries].reverse()} />
    </section>
  );
}

export function ErrorState({
  message,
  title,
}: Readonly<{
  message: string;
  title: string;
}>) {
  return (
    <section className="card empty-state">
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}

export function formatTimestamp(value?: string): string {
  if (!value) {
    return "n/a";
  }

  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function TimelineEntries({
  entries,
}: Readonly<{
  entries: readonly ApiTimeline["entries"][number][];
}>) {
  if (entries.length === 0) {
    return <p className="empty-copy">No replay events recorded yet.</p>;
  }

  return (
    <ol className="timeline-list">
      {entries.map((entry) => (
        <li className="timeline-entry" key={entry.sequence}>
          <div className="row spread">
            <strong>{entry.kind}</strong>
            <span>{formatTimestamp(entry.occurredAt)}</span>
          </div>
          <div className="timeline-meta">
            event: {entry.eventName}
            {entry.stepId ? ` · step ${entry.stepId}` : ""}
          </div>
          <pre className="payload-preview">
            {JSON.stringify(entry.payload, null, 2)}
          </pre>
        </li>
      ))}
    </ol>
  );
}

function MetadataRow({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function StatusBadge({
  status,
}: Readonly<{
  status: string;
}>) {
  const tone =
    status === "succeeded" || status === "approved"
      ? "success"
      : status === "failed" || status === "rejected" || status === "cancelled"
        ? "danger"
        : status === "paused" || status === "pending"
          ? "warning"
          : "neutral";

  return <span className={`status-pill ${tone}`}>{status}</span>;
}

function readAuditEntryKey(entry: ApiAuditView["entries"][number]): string {
  switch (entry.fact.sourceOfTruth) {
    case "dispatch":
      return `${entry.fact.dispatchJobId}:${entry.kind}`;
    case "runtime-event":
      return entry.fact.eventId;
    case "tool-history":
      return entry.fact.callId;
  }
}

function joinOrFallback(values: readonly string[], fallback: string): string {
  return values.length > 0 ? values.join(", ") : fallback;
}

function countSavedViewSummaryFilters(
  filters: ApiAuditNavigationFilters["summary"],
): number {
  return [
    filters.definitionId,
    filters.executionMode,
    filters.runStatus,
    filters.toolName,
  ].filter(Boolean).length;
}

function countSavedViewDrilldownFilters(
  filters: ApiCrossRunAuditDrilldownFilters,
): number {
  return [
    filters.approvalId,
    filters.dispatchJobId,
    filters.runId,
    filters.stepId,
    filters.toolCallId,
    filters.toolId,
    filters.workerId,
  ].filter(Boolean).length;
}

function formatProgressSummary(
  items: readonly ApiAuditCatalogChecklistItemProgressItem[],
): string {
  const completedCount = items.filter(
    (item) => item.state === "completed",
  ).length;

  return `${completedCount}/${items.length} completed`;
}

function formatBlockerSummary(
  items: readonly ApiAuditCatalogChecklistItemBlockerItem[],
): string {
  const blockedCount = items.filter((item) => item.state === "blocked").length;

  return `${blockedCount}/${items.length} blocked`;
}

function formatResolutionSummary(
  items: readonly ApiAuditCatalogChecklistItemResolutionItem[],
): string {
  const resolvedCount = items.filter(
    (item) => item.state === "resolved",
  ).length;

  return `${resolvedCount}/${items.length} resolved`;
}

function formatVerificationSummary(
  items: readonly ApiAuditCatalogChecklistItemVerificationItem[],
): string {
  const verifiedCount = items.filter(
    (item) => item.state === "verified",
  ).length;

  return `${verifiedCount}/${items.length} verified`;
}

function formatEvidenceSummary(
  items: readonly ApiAuditCatalogChecklistItemEvidenceItem[],
): string {
  const referenceCount = items.reduce(
    (count, item) => count + item.references.length,
    0,
  );

  return `${referenceCount} reference(s) across ${items.length} item(s)`;
}

function formatAttestationSummary(
  items: readonly ApiAuditCatalogChecklistItemAttestationItem[],
): string {
  const attestedCount = items.filter(
    (item) => item.state === "attested",
  ).length;

  return `${attestedCount}/${items.length} attested`;
}

function formatAcknowledgmentSummary(
  items: readonly ApiAuditCatalogChecklistItemAcknowledgmentItem[],
): string {
  const acknowledgedCount = items.filter(
    (item) => item.state === "acknowledged",
  ).length;

  return `${acknowledgedCount}/${items.length} acknowledged`;
}

function formatSignoffSummary(
  items: readonly ApiAuditCatalogChecklistItemSignoffItem[],
): string {
  const signedOffCount = items.filter(
    (item) => item.state === "signed-off",
  ).length;

  return `${signedOffCount}/${items.length} signed off`;
}

function formatExceptionSummary(
  items: readonly ApiAuditCatalogChecklistItemExceptionItem[],
): string {
  const exceptedCount = items.filter(
    (item) => item.state === "excepted",
  ).length;

  return `${exceptedCount}/${items.length} excepted`;
}

function formatChecklistItemProgressLines(
  checklistItems: readonly string[],
  progressItems:
    | readonly ApiAuditCatalogChecklistItemProgressItem[]
    | undefined,
): string {
  const progressByItem = new Map(
    (progressItems ?? []).map((item) => [item.item, item.state] as const),
  );

  return checklistItems
    .map((item) => `${progressByItem.get(item) ?? "pending"}: ${item}`)
    .join("\n");
}

function formatChecklistItemBlockerLines(
  progressItems: readonly ApiAuditCatalogChecklistItemProgressItem[],
  blockerItems: readonly ApiAuditCatalogChecklistItemBlockerItem[] | undefined,
): string {
  const blockerByItem = new Map(
    (blockerItems ?? []).map((item) => [item.item, item.state] as const),
  );

  return progressItems
    .map((item) => `${blockerByItem.get(item.item) ?? "cleared"}: ${item.item}`)
    .join("\n");
}

function formatChecklistItemResolutionLines(
  blockerItems: readonly ApiAuditCatalogChecklistItemBlockerItem[],
  resolutionItems:
    | readonly ApiAuditCatalogChecklistItemResolutionItem[]
    | undefined,
): string {
  const resolutionByItem = new Map(
    (resolutionItems ?? []).map((item) => [item.item, item.state] as const),
  );

  return blockerItems
    .map(
      (item) =>
        `${resolutionByItem.get(item.item) ?? "unresolved"}: ${item.item}`,
    )
    .join("\n");
}

function formatChecklistItemVerificationLines(
  resolutionItems: readonly ApiAuditCatalogChecklistItemResolutionItem[],
  verificationItems:
    | readonly ApiAuditCatalogChecklistItemVerificationItem[]
    | undefined,
): string {
  const verificationByItem = new Map(
    (verificationItems ?? []).map((item) => [item.item, item.state] as const),
  );

  return resolutionItems
    .map(
      (item) =>
        `${verificationByItem.get(item.item) ?? "unverified"}: ${item.item}`,
    )
    .join("\n");
}

function formatChecklistItemEvidenceLines(
  verificationItems: readonly ApiAuditCatalogChecklistItemVerificationItem[],
  evidenceItems:
    | readonly ApiAuditCatalogChecklistItemEvidenceItem[]
    | undefined,
): string {
  const evidenceByItem = new Map(
    (evidenceItems ?? []).map((item) => [item.item, item.references] as const),
  );

  return verificationItems
    .map((item) => {
      const references = evidenceByItem.get(item.item) ?? [];

      return `${item.item}: ${references.join(" | ")}`.trimEnd();
    })
    .join("\n");
}

function formatChecklistItemAttestationLines(
  evidenceItems: readonly ApiAuditCatalogChecklistItemEvidenceItem[],
  attestationItems:
    | readonly ApiAuditCatalogChecklistItemAttestationItem[]
    | undefined,
): string {
  const attestationByItem = new Map(
    (attestationItems ?? []).map((item) => [item.item, item.state] as const),
  );

  return evidenceItems
    .map(
      (item) =>
        `${attestationByItem.get(item.item) ?? "unattested"}: ${item.item}`,
    )
    .join("\n");
}

function formatChecklistItemAcknowledgmentLines(
  attestationItems: readonly ApiAuditCatalogChecklistItemAttestationItem[],
  acknowledgmentItems:
    | readonly ApiAuditCatalogChecklistItemAcknowledgmentItem[]
    | undefined,
): string {
  const acknowledgmentByItem = new Map(
    (acknowledgmentItems ?? []).map((item) => [item.item, item.state] as const),
  );

  return attestationItems
    .map(
      (item) =>
        `${acknowledgmentByItem.get(item.item) ?? "unacknowledged"}: ${item.item}`,
    )
    .join("\n");
}

function formatChecklistItemSignoffLines(
  acknowledgmentItems:
    | readonly ApiAuditCatalogChecklistItemAcknowledgmentItem[]
    | undefined,
  signoffItems: readonly ApiAuditCatalogChecklistItemSignoffItem[] | undefined,
): string {
  const signoffByItem = new Map(
    (signoffItems ?? []).map((item) => [item.item, item.state] as const),
  );

  return (acknowledgmentItems ?? [])
    .map(
      (item) => `${signoffByItem.get(item.item) ?? "unsigned"}: ${item.item}`,
    )
    .join("\n");
}

function formatChecklistItemExceptionLines(
  signoffItems: readonly ApiAuditCatalogChecklistItemSignoffItem[] | undefined,
  exceptionItems:
    | readonly ApiAuditCatalogChecklistItemExceptionItem[]
    | undefined,
): string {
  const exceptionByItem = new Map(
    (exceptionItems ?? []).map((item) => [item.item, item.state] as const),
  );

  return (signoffItems ?? [])
    .map(
      (item) =>
        `${exceptionByItem.get(item.item) ?? "not-excepted"}: ${item.item}`,
    )
    .join("\n");
}

function buildSavedAuditViewHref(savedViewId: string): string {
  return `/runs?savedViewId=${encodeURIComponent(savedViewId)}`;
}

function buildCatalogEntryHref(catalogEntryId: string): string {
  return `/runs?catalogEntryId=${encodeURIComponent(catalogEntryId)}`;
}

function buildAuditDrilldownHref(
  filters: ApiCrossRunAuditDrilldownFilters,
): string {
  return buildAuditNavigationPageHref({}, filters);
}

function buildNavigationLinkHref(
  link: ApiAuditDrilldownLink | ApiRunAuditViewLink,
  summaryFilters: ApiAuditNavigationFilters["summary"],
): string {
  if (link.kind === "run-audit-view") {
    return `/runs/${link.runId}`;
  }

  return buildAuditNavigationPageHref(summaryFilters, link.filters);
}

function buildAuditNavigationPageHref(
  summaryFilters: ApiAuditNavigationFilters["summary"],
  drilldownFilters: ApiCrossRunAuditDrilldownFilters,
): string {
  const params = new URLSearchParams();

  if (summaryFilters.definitionId) {
    params.set("auditDefinitionId", summaryFilters.definitionId);
  }

  if (summaryFilters.runStatus) {
    params.set("auditStatus", summaryFilters.runStatus);
  }

  if (summaryFilters.executionMode) {
    params.set("auditExecutionMode", summaryFilters.executionMode);
  }

  if (summaryFilters.toolName) {
    params.set("auditToolName", summaryFilters.toolName);
  }

  if (drilldownFilters.approvalId) {
    params.set("drilldownApprovalId", drilldownFilters.approvalId);
  }

  if (drilldownFilters.dispatchJobId) {
    params.set("drilldownDispatchJobId", drilldownFilters.dispatchJobId);
  }

  if (drilldownFilters.runId) {
    params.set("drilldownRunId", drilldownFilters.runId);
  }

  if (drilldownFilters.stepId) {
    params.set("drilldownStepId", drilldownFilters.stepId);
  }

  if (drilldownFilters.toolCallId) {
    params.set("drilldownToolCallId", drilldownFilters.toolCallId);
  }

  if (drilldownFilters.toolId) {
    params.set("drilldownToolId", drilldownFilters.toolId);
  }

  if (drilldownFilters.workerId) {
    params.set("drilldownWorkerId", drilldownFilters.workerId);
  }

  const query = params.toString();

  return query.length > 0 ? `/runs?${query}` : "/runs";
}

function HiddenField({
  name,
  value,
}: Readonly<{
  name: string;
  value: string | undefined;
}>) {
  if (!value) {
    return null;
  }

  return <input name={name} type="hidden" value={value} />;
}
