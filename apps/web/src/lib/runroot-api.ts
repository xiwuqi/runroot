import {
  createNoopLogger,
  createNoopTracer,
  type RunrootLogger,
  type RunrootTracer,
  withinSpan,
} from "@runroot/observability";

export interface ApiRun {
  readonly createdAt: string;
  readonly currentStepIndex: number;
  readonly definitionId: string;
  readonly definitionName: string;
  readonly definitionVersion: string;
  readonly id: string;
  readonly metadata: Readonly<Record<string, string>>;
  readonly output?: Readonly<Record<string, unknown>>;
  readonly pauseReason?: string;
  readonly pausedAt?: string;
  readonly status: string;
  readonly updatedAt: string;
}

export interface ApiApprovalActor {
  readonly displayName?: string;
  readonly id: string;
}

export interface ApiApproval {
  readonly decidedAt?: string;
  readonly decidedBy?: ApiApprovalActor;
  readonly decision?: "approved" | "cancelled" | "rejected";
  readonly decisionNote?: string;
  readonly id: string;
  readonly note?: string;
  readonly requestedAt: string;
  readonly requestedBy?: ApiApprovalActor;
  readonly reviewer?: ApiApprovalActor;
  readonly runId: string;
  readonly status: "approved" | "cancelled" | "pending" | "rejected";
  readonly stepId?: string;
}

export interface PendingApprovalSummary {
  readonly approval: ApiApproval;
  readonly run: ApiRun;
}

export interface ApiTimelineEntry {
  readonly eventName: string;
  readonly kind: string;
  readonly occurredAt: string;
  readonly payload: unknown;
  readonly sequence: number;
  readonly stepId?: string;
}

export interface ApiTimeline {
  readonly entries: readonly ApiTimelineEntry[];
  readonly runId: string;
}

export interface ApiToolHistoryEntry {
  readonly attempt?: number;
  readonly callId: string;
  readonly dispatchJobId?: string;
  readonly executionMode?: "inline" | "queued";
  readonly finishedAt: string;
  readonly inputSummary: string;
  readonly outcome: "blocked" | "failed" | "succeeded";
  readonly outcomeDetail?: string;
  readonly outputSummary?: string;
  readonly runId?: string;
  readonly source: string;
  readonly startedAt: string;
  readonly stepId?: string;
  readonly toolId: string;
  readonly toolName: string;
  readonly toolSource: string;
  readonly workerId?: string;
}

export interface ApiAuditEntry {
  readonly correlation: {
    readonly approvalId?: string;
    readonly dispatchJobId?: string;
    readonly runId: string;
    readonly stepId?: string;
    readonly toolCallId?: string;
    readonly toolId?: string;
    readonly workerId?: string;
  };
  readonly detail?: string;
  readonly fact:
    | {
        readonly eventId: string;
        readonly eventName: string;
        readonly payload: unknown;
        readonly sequence: number;
        readonly sourceOfTruth: "runtime-event";
      }
    | {
        readonly attempts: number;
        readonly dispatchJobId: string;
        readonly dispatchKind: string;
        readonly dispatchStatus: string;
        readonly sourceOfTruth: "dispatch";
        readonly workerId?: string;
      }
    | {
        readonly attempt?: number;
        readonly callId: string;
        readonly executionMode?: "inline" | "queued";
        readonly inputSummary: string;
        readonly outcome: "blocked" | "failed" | "succeeded";
        readonly outcomeDetail?: string;
        readonly outputSummary?: string;
        readonly source: string;
        readonly sourceOfTruth: "tool-history";
        readonly toolName: string;
        readonly toolSource: string;
      };
  readonly kind: string;
  readonly occurredAt: string;
  readonly summary: string;
}

export interface ApiAuditView {
  readonly entries: readonly ApiAuditEntry[];
  readonly runId: string;
}

export interface ApiCrossRunAuditFilters {
  readonly definitionId?: string;
  readonly executionMode?: "inline" | "queued";
  readonly runStatus?: string;
  readonly toolName?: string;
}

export interface ApiCrossRunAuditApprovalSummary {
  readonly approvalId: string;
  readonly status: "approved" | "cancelled" | "pending" | "rejected";
  readonly stepId?: string;
}

export interface ApiCrossRunAuditDispatchSummary {
  readonly dispatchJobId: string;
  readonly kind: string;
  readonly status: string;
  readonly workerId?: string;
}

export interface ApiCrossRunAuditToolSummary {
  readonly callId: string;
  readonly dispatchJobId?: string;
  readonly executionMode?: "inline" | "queued";
  readonly outcome: "blocked" | "failed" | "succeeded";
  readonly stepId?: string;
  readonly toolId?: string;
  readonly toolName: string;
  readonly workerId?: string;
}

export interface ApiCrossRunAuditResult {
  readonly approvals: readonly ApiCrossRunAuditApprovalSummary[];
  readonly definitionId: string;
  readonly definitionName: string;
  readonly dispatchJobs: readonly ApiCrossRunAuditDispatchSummary[];
  readonly executionModes: readonly ("inline" | "queued")[];
  readonly lastOccurredAt?: string;
  readonly runId: string;
  readonly runStatus: string;
  readonly stepIds: readonly string[];
  readonly summary: string;
  readonly toolCalls: readonly ApiCrossRunAuditToolSummary[];
  readonly updatedAt: string;
  readonly workerIds: readonly string[];
}

export interface ApiCrossRunAuditResults {
  readonly filters: ApiCrossRunAuditFilters;
  readonly results: readonly ApiCrossRunAuditResult[];
  readonly totalCount: number;
}

export interface ApiCrossRunAuditDrilldownFilters {
  readonly approvalId?: string;
  readonly dispatchJobId?: string;
  readonly runId?: string;
  readonly stepId?: string;
  readonly toolCallId?: string;
  readonly toolId?: string;
  readonly workerId?: string;
}

export interface ApiCrossRunAuditDrilldownIdentifiers {
  readonly approvalIds: readonly string[];
  readonly dispatchJobIds: readonly string[];
  readonly runIds: readonly string[];
  readonly stepIds: readonly string[];
  readonly toolCallIds: readonly string[];
  readonly toolIds: readonly string[];
  readonly workerIds: readonly string[];
}

export interface ApiCrossRunAuditDrilldownResult {
  readonly definitionId: string;
  readonly definitionName: string;
  readonly entries: readonly ApiAuditEntry[];
  readonly identifiers: ApiCrossRunAuditDrilldownIdentifiers;
  readonly lastOccurredAt?: string;
  readonly matchedEntryCount: number;
  readonly runId: string;
  readonly runStatus: string;
  readonly summary: string;
  readonly updatedAt: string;
}

export interface ApiCrossRunAuditDrilldownResults {
  readonly filters: ApiCrossRunAuditDrilldownFilters;
  readonly isConstrained: boolean;
  readonly results: readonly ApiCrossRunAuditDrilldownResult[];
  readonly totalCount: number;
  readonly totalMatchedEntryCount: number;
}

export interface ApiAuditNavigationFilters {
  readonly drilldown: ApiCrossRunAuditDrilldownFilters;
  readonly summary: ApiCrossRunAuditFilters;
}

export interface ApiAuditNavigationLink {
  readonly kind: "audit-drilldown" | "run-audit-view";
  readonly label: string;
  readonly runId: string;
  readonly summary: string;
}

export interface ApiAuditDrilldownLink extends ApiAuditNavigationLink {
  readonly filters: ApiCrossRunAuditDrilldownFilters;
  readonly kind: "audit-drilldown";
}

export interface ApiRunAuditViewLink extends ApiAuditNavigationLink {
  readonly kind: "run-audit-view";
}

export interface ApiAuditNavigationSummary {
  readonly links: {
    readonly auditView: ApiRunAuditViewLink;
    readonly drilldowns: readonly ApiAuditDrilldownLink[];
  };
  readonly result: ApiCrossRunAuditResult;
}

export interface ApiAuditNavigationDrilldown {
  readonly links: {
    readonly auditView: ApiRunAuditViewLink;
  };
  readonly result: ApiCrossRunAuditDrilldownResult;
}

export interface ApiAuditNavigationView {
  readonly drilldowns: readonly ApiAuditNavigationDrilldown[];
  readonly filters: ApiAuditNavigationFilters;
  readonly isConstrained: boolean;
  readonly summaries: readonly ApiAuditNavigationSummary[];
  readonly totalDrilldownCount: number;
  readonly totalMatchedEntryCount: number;
  readonly totalSummaryCount: number;
}

export type ApiAuditSavedViewKind = "operator-preset" | "saved-view";

export interface ApiAuditSavedViewNavigationRefs {
  readonly auditViewRunId?: string;
  readonly drilldownRunId?: string;
}

export interface ApiAuditSavedView {
  readonly createdAt: string;
  readonly description?: string;
  readonly id: string;
  readonly kind: ApiAuditSavedViewKind;
  readonly name: string;
  readonly navigation: ApiAuditNavigationFilters;
  readonly refs: ApiAuditSavedViewNavigationRefs;
  readonly updatedAt: string;
}

export interface ApiAuditSavedViewCollection {
  readonly items: readonly ApiAuditSavedView[];
  readonly totalCount: number;
}

export interface ApiAuditSavedViewApplication {
  readonly navigation: ApiAuditNavigationView;
  readonly savedView: ApiAuditSavedView;
}

export interface ApiAuditCatalogEntry {
  readonly archivedAt?: string;
  readonly createdAt: string;
  readonly description?: string;
  readonly id: string;
  readonly kind: "catalog-entry";
  readonly name: string;
  readonly savedViewId: string;
  readonly updatedAt: string;
}

export interface ApiAuditCatalogEntryView {
  readonly entry: ApiAuditCatalogEntry;
  readonly savedView: ApiAuditSavedView;
}

export interface ApiAuditCatalogEntryCollection {
  readonly items: readonly ApiAuditCatalogEntryView[];
  readonly totalCount: number;
}

export interface ApiAuditCatalogEntryApplication {
  readonly application: ApiAuditSavedViewApplication;
  readonly catalogEntry: ApiAuditCatalogEntryView;
}

export interface CreateApiAuditCatalogEntryInput {
  readonly description?: string;
  readonly name?: string;
  readonly savedViewId: string;
}

export interface CreateApiAuditSavedViewInput {
  readonly description?: string;
  readonly kind?: ApiAuditSavedViewKind;
  readonly name: string;
  readonly navigation?: Partial<ApiAuditNavigationFilters>;
  readonly refs?: ApiAuditSavedViewNavigationRefs;
}

export interface DecideApprovalRequest {
  readonly actorDisplayName?: string;
  readonly actorId?: string;
  readonly decision: "approved" | "cancelled" | "rejected";
  readonly note?: string;
}

export interface RunrootApiClient {
  applyAuditCatalogEntry(
    catalogEntryId: string,
  ): Promise<ApiAuditCatalogEntryApplication>;
  applySavedAuditView(
    savedViewId: string,
  ): Promise<ApiAuditSavedViewApplication>;
  archiveAuditCatalogEntry(
    catalogEntryId: string,
  ): Promise<ApiAuditCatalogEntryView>;
  decideApproval(
    approvalId: string,
    input: DecideApprovalRequest,
  ): Promise<ApiApproval>;
  getAuditNavigation(
    filters?: Partial<ApiAuditNavigationFilters>,
  ): Promise<ApiAuditNavigationView>;
  getApprovals(runId: string): Promise<readonly ApiApproval[]>;
  getPendingApprovals(): Promise<readonly PendingApprovalSummary[]>;
  getRun(runId: string): Promise<ApiRun>;
  getAuditView(runId: string): Promise<ApiAuditView>;
  getAuditCatalogEntry(
    catalogEntryId: string,
  ): Promise<ApiAuditCatalogEntryView>;
  getSavedAuditView(savedViewId: string): Promise<ApiAuditSavedView>;
  listAuditCatalogEntries(): Promise<ApiAuditCatalogEntryCollection>;
  listAuditDrilldowns(
    filters?: ApiCrossRunAuditDrilldownFilters,
  ): Promise<ApiCrossRunAuditDrilldownResults>;
  listAuditResults(
    filters?: ApiCrossRunAuditFilters,
  ): Promise<ApiCrossRunAuditResults>;
  listSavedAuditViews(): Promise<ApiAuditSavedViewCollection>;
  publishAuditCatalogEntry(
    input: CreateApiAuditCatalogEntryInput,
  ): Promise<ApiAuditCatalogEntryView>;
  saveSavedAuditView(
    input: CreateApiAuditSavedViewInput,
  ): Promise<ApiAuditSavedView>;
  getToolHistory(runId: string): Promise<readonly ApiToolHistoryEntry[]>;
  getTimeline(runId: string): Promise<ApiTimeline>;
  listRuns(): Promise<readonly ApiRun[]>;
  resumeRun(runId: string): Promise<ApiRun>;
}

export interface RunrootApiClientOptions {
  readonly baseUrl?: string;
  readonly fetchImplementation?: typeof fetch;
  readonly logger?: RunrootLogger;
  readonly tracer?: RunrootTracer;
}

export class RunrootApiError extends Error {
  readonly path: string;
  readonly statusCode: number;

  constructor(message: string, statusCode: number, path: string) {
    super(message);
    this.name = "RunrootApiError";
    this.path = path;
    this.statusCode = statusCode;
  }
}

export function resolveRunrootApiBaseUrl(baseUrl?: string): string {
  return (
    baseUrl ??
    process.env.RUNROOT_API_BASE_URL ??
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
}

export function createRunrootApiClient(
  options: RunrootApiClientOptions = {},
): RunrootApiClient {
  const baseUrl = resolveRunrootApiBaseUrl(options.baseUrl);
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const logger = (options.logger ?? createNoopLogger()).child({
    surface: "web",
  });
  const tracer = options.tracer ?? createNoopTracer();

  async function requestJson<TValue>(
    path: string,
    init: RequestInit,
    traceName: string,
  ): Promise<TValue> {
    return withinSpan(
      tracer,
      traceName,
      async (span) => {
        logger.log({
          attributes: {
            method: init.method ?? "GET",
            path,
          },
          level: "info",
          message: "runroot api request",
        });

        const response = await fetchImplementation(`${baseUrl}${path}`, {
          cache: "no-store",
          ...init,
        });

        span.addEvent("response", {
          path,
          statusCode: response.status,
        });

        if (!response.ok) {
          const body = await response.text();

          logger.log({
            attributes: {
              method: init.method ?? "GET",
              path,
              statusCode: response.status,
            },
            level: "error",
            message: "runroot api request failed",
          });

          throw new RunrootApiError(
            body || `Request to ${path} failed with status ${response.status}.`,
            response.status,
            path,
          );
        }

        logger.log({
          attributes: {
            method: init.method ?? "GET",
            path,
            statusCode: response.status,
          },
          level: "info",
          message: "runroot api request completed",
        });

        return (await response.json()) as TValue;
      },
      {
        attributes: {
          httpMethod: init.method ?? "GET",
          path,
        },
      },
    );
  }

  return {
    async applyAuditCatalogEntry(catalogEntryId) {
      const payload = await requestJson<{
        application: ApiAuditCatalogEntryApplication;
      }>(
        `/audit/catalog/${catalogEntryId}/apply`,
        { method: "GET" },
        "web.api.applyAuditCatalogEntry",
      );

      return payload.application;
    },

    async applySavedAuditView(savedViewId) {
      const payload = await requestJson<{
        application: ApiAuditSavedViewApplication;
      }>(
        `/audit/saved-views/${savedViewId}/apply`,
        { method: "GET" },
        "web.api.applySavedAuditView",
      );

      return payload.application;
    },

    async archiveAuditCatalogEntry(catalogEntryId) {
      const payload = await requestJson<{
        catalogEntry: ApiAuditCatalogEntryView;
      }>(
        `/audit/catalog/${catalogEntryId}/archive`,
        { method: "POST" },
        "web.api.archiveAuditCatalogEntry",
      );

      return payload.catalogEntry;
    },

    async decideApproval(approvalId, input) {
      const payload = await requestJson<{
        approval: ApiApproval;
      }>(
        `/approvals/${approvalId}/decision`,
        {
          body: JSON.stringify(input),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
        "web.api.decideApproval",
      );

      return payload.approval;
    },

    async getAuditNavigation(filters) {
      const payload = await requestJson<{
        audit: ApiAuditNavigationView;
      }>(
        buildAuditNavigationPath(filters),
        { method: "GET" },
        "web.api.getAuditNavigation",
      );

      return payload.audit;
    },

    async getApprovals(runId) {
      const payload = await requestJson<{
        approvals: readonly ApiApproval[];
      }>(`/runs/${runId}/approvals`, { method: "GET" }, "web.api.getApprovals");

      return payload.approvals;
    },

    async getPendingApprovals() {
      const payload = await requestJson<{
        approvals: readonly PendingApprovalSummary[];
      }>(
        "/approvals/pending",
        {
          method: "GET",
        },
        "web.api.getPendingApprovals",
      );

      return payload.approvals;
    },

    async getRun(runId) {
      const payload = await requestJson<{
        run: ApiRun;
      }>(`/runs/${runId}`, { method: "GET" }, "web.api.getRun");

      return payload.run;
    },

    async getAuditView(runId) {
      const payload = await requestJson<{
        audit: ApiAuditView;
      }>(`/runs/${runId}/audit`, { method: "GET" }, "web.api.getAuditView");

      return payload.audit;
    },

    async getAuditCatalogEntry(catalogEntryId) {
      const payload = await requestJson<{
        catalogEntry: ApiAuditCatalogEntryView;
      }>(
        `/audit/catalog/${catalogEntryId}`,
        { method: "GET" },
        "web.api.getAuditCatalogEntry",
      );

      return payload.catalogEntry;
    },

    async getSavedAuditView(savedViewId) {
      const payload = await requestJson<{
        savedView: ApiAuditSavedView;
      }>(
        `/audit/saved-views/${savedViewId}`,
        { method: "GET" },
        "web.api.getSavedAuditView",
      );

      return payload.savedView;
    },

    async listAuditDrilldowns(filters) {
      const payload = await requestJson<{
        audit: ApiCrossRunAuditDrilldownResults;
      }>(
        buildCrossRunAuditDrilldownPath(filters),
        { method: "GET" },
        "web.api.listAuditDrilldowns",
      );

      return payload.audit;
    },

    async listAuditCatalogEntries() {
      const payload = await requestJson<{
        catalog: ApiAuditCatalogEntryCollection;
      }>(
        "/audit/catalog",
        { method: "GET" },
        "web.api.listAuditCatalogEntries",
      );

      return payload.catalog;
    },

    async listAuditResults(filters) {
      const payload = await requestJson<{
        audit: ApiCrossRunAuditResults;
      }>(
        buildCrossRunAuditPath(filters),
        { method: "GET" },
        "web.api.listAuditResults",
      );

      return payload.audit;
    },

    async listSavedAuditViews() {
      const payload = await requestJson<{
        savedViews: ApiAuditSavedViewCollection;
      }>(
        "/audit/saved-views",
        { method: "GET" },
        "web.api.listSavedAuditViews",
      );

      return payload.savedViews;
    },

    async publishAuditCatalogEntry(input) {
      const payload = await requestJson<{
        catalogEntry: ApiAuditCatalogEntryView;
      }>(
        "/audit/catalog",
        {
          body: JSON.stringify(input),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
        "web.api.publishAuditCatalogEntry",
      );

      return payload.catalogEntry;
    },

    async saveSavedAuditView(input) {
      const payload = await requestJson<{
        savedView: ApiAuditSavedView;
      }>(
        "/audit/saved-views",
        {
          body: JSON.stringify(input),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
        "web.api.saveSavedAuditView",
      );

      return payload.savedView;
    },

    async getToolHistory(runId) {
      const payload = await requestJson<{
        entries: readonly ApiToolHistoryEntry[];
      }>(
        `/runs/${runId}/tool-history`,
        { method: "GET" },
        "web.api.getToolHistory",
      );

      return payload.entries;
    },

    async getTimeline(runId) {
      const payload = await requestJson<{
        timeline: ApiTimeline;
      }>(`/runs/${runId}/timeline`, { method: "GET" }, "web.api.getTimeline");

      return payload.timeline;
    },

    async listRuns() {
      const payload = await requestJson<{
        runs: readonly ApiRun[];
      }>("/runs", { method: "GET" }, "web.api.listRuns");

      return payload.runs;
    },

    async resumeRun(runId) {
      const payload = await requestJson<{
        run: ApiRun;
      }>(`/runs/${runId}/resume`, { method: "POST" }, "web.api.resumeRun");

      return payload.run;
    },
  };
}

function buildCrossRunAuditPath(
  filters: ApiCrossRunAuditFilters | undefined,
): string {
  if (!filters) {
    return "/audit/runs";
  }

  const params = new URLSearchParams();

  if (filters.definitionId) {
    params.set("definitionId", filters.definitionId);
  }

  if (filters.executionMode) {
    params.set("executionMode", filters.executionMode);
  }

  if (filters.runStatus) {
    params.set("runStatus", filters.runStatus);
  }

  if (filters.toolName) {
    params.set("toolName", filters.toolName);
  }

  const query = params.toString();

  return query.length > 0 ? `/audit/runs?${query}` : "/audit/runs";
}

function buildCrossRunAuditDrilldownPath(
  filters: ApiCrossRunAuditDrilldownFilters | undefined,
): string {
  if (!filters) {
    return "/audit/drilldowns";
  }

  const params = new URLSearchParams();

  if (filters.approvalId) {
    params.set("approvalId", filters.approvalId);
  }

  if (filters.dispatchJobId) {
    params.set("dispatchJobId", filters.dispatchJobId);
  }

  if (filters.runId) {
    params.set("runId", filters.runId);
  }

  if (filters.stepId) {
    params.set("stepId", filters.stepId);
  }

  if (filters.toolCallId) {
    params.set("toolCallId", filters.toolCallId);
  }

  if (filters.toolId) {
    params.set("toolId", filters.toolId);
  }

  if (filters.workerId) {
    params.set("workerId", filters.workerId);
  }

  const query = params.toString();

  return query.length > 0 ? `/audit/drilldowns?${query}` : "/audit/drilldowns";
}

function buildAuditNavigationPath(
  filters: Partial<ApiAuditNavigationFilters> | undefined,
): string {
  if (!filters) {
    return "/audit/navigation";
  }

  const params = new URLSearchParams();
  const summary = filters.summary ?? {};
  const drilldown = filters.drilldown ?? {};

  if (summary.definitionId) {
    params.set("definitionId", summary.definitionId);
  }

  if (summary.executionMode) {
    params.set("executionMode", summary.executionMode);
  }

  if (summary.runStatus) {
    params.set("runStatus", summary.runStatus);
  }

  if (summary.toolName) {
    params.set("toolName", summary.toolName);
  }

  if (drilldown.approvalId) {
    params.set("approvalId", drilldown.approvalId);
  }

  if (drilldown.dispatchJobId) {
    params.set("dispatchJobId", drilldown.dispatchJobId);
  }

  if (drilldown.runId) {
    params.set("runId", drilldown.runId);
  }

  if (drilldown.stepId) {
    params.set("stepId", drilldown.stepId);
  }

  if (drilldown.toolCallId) {
    params.set("toolCallId", drilldown.toolCallId);
  }

  if (drilldown.toolId) {
    params.set("toolId", drilldown.toolId);
  }

  if (drilldown.workerId) {
    params.set("workerId", drilldown.workerId);
  }

  const query = params.toString();

  return query.length > 0 ? `/audit/navigation?${query}` : "/audit/navigation";
}
