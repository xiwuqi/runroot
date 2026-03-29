import type { ReactNode } from "react";
import type { FlashMessage } from "../lib/navigation";
import type {
  ApiApproval,
  ApiAuditView,
  ApiRun,
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
