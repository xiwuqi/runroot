import type { ReactNode } from "react";
import type { FlashMessage } from "../lib/navigation";
import type {
  ApiApproval,
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

export function AuditViewCatalogsView({
  activeCatalogEntry,
  catalogEntries,
}: Readonly<{
  activeCatalogEntry?: ApiAuditCatalogVisibilityView;
  catalogEntries: ApiAuditCatalogVisibilityCollection;
}>) {
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
              <div className="row spread">
                <div>
                  <strong>{catalogEntry.catalogEntry.entry.name}</strong>
                  <div className="timeline-meta">
                    {catalogEntry.catalogEntry.entry.kind} ·{" "}
                    {catalogEntry.visibility.state}
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
              </div>
              <div className="timeline-meta">
                summary filters{" "}
                {countSavedViewSummaryFilters(
                  catalogEntry.catalogEntry.savedView.navigation.summary,
                )}
                {" · "}drilldown filters{" "}
                {countSavedViewDrilldownFilters(
                  catalogEntry.catalogEntry.savedView.navigation.drilldown,
                )}
              </div>
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
