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

export interface DecideApprovalRequest {
  readonly actorDisplayName?: string;
  readonly actorId?: string;
  readonly decision: "approved" | "cancelled" | "rejected";
  readonly note?: string;
}

export interface RunrootApiClient {
  decideApproval(
    approvalId: string,
    input: DecideApprovalRequest,
  ): Promise<ApiApproval>;
  getApprovals(runId: string): Promise<readonly ApiApproval[]>;
  getPendingApprovals(): Promise<readonly PendingApprovalSummary[]>;
  getRun(runId: string): Promise<ApiRun>;
  getAuditView(runId: string): Promise<ApiAuditView>;
  listAuditDrilldowns(
    filters?: ApiCrossRunAuditDrilldownFilters,
  ): Promise<ApiCrossRunAuditDrilldownResults>;
  listAuditResults(
    filters?: ApiCrossRunAuditFilters,
  ): Promise<ApiCrossRunAuditResults>;
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
