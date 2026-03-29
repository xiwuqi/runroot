import type { RunId } from "@runroot/domain";

import type {
  CrossRunAuditQueryFilters,
  CrossRunAuditResult,
  CrossRunAuditResults,
} from "./cross-run";
import type {
  CrossRunAuditDrilldownFilters,
  CrossRunAuditDrilldownResult,
  CrossRunAuditDrilldownResults,
} from "./drilldown";

export interface CrossRunAuditNavigationFilters {
  readonly drilldown: CrossRunAuditDrilldownFilters;
  readonly summary: CrossRunAuditQueryFilters;
}

export interface CrossRunAuditNavigationLink {
  readonly kind: "audit-drilldown" | "run-audit-view";
  readonly label: string;
  readonly runId: RunId;
  readonly summary: string;
}

export interface CrossRunAuditDrilldownLink
  extends CrossRunAuditNavigationLink {
  readonly filters: CrossRunAuditDrilldownFilters;
  readonly kind: "audit-drilldown";
}

export interface RunAuditViewLink extends CrossRunAuditNavigationLink {
  readonly kind: "run-audit-view";
}

export interface CrossRunAuditNavigationSummary {
  readonly links: {
    readonly auditView: RunAuditViewLink;
    readonly drilldowns: readonly CrossRunAuditDrilldownLink[];
  };
  readonly result: CrossRunAuditResult;
}

export interface CrossRunAuditNavigationDrilldown {
  readonly links: {
    readonly auditView: RunAuditViewLink;
  };
  readonly result: CrossRunAuditDrilldownResult;
}

export interface CrossRunAuditNavigationView {
  readonly drilldowns: readonly CrossRunAuditNavigationDrilldown[];
  readonly filters: CrossRunAuditNavigationFilters;
  readonly isConstrained: boolean;
  readonly summaries: readonly CrossRunAuditNavigationSummary[];
  readonly totalDrilldownCount: number;
  readonly totalMatchedEntryCount: number;
  readonly totalSummaryCount: number;
}

export function projectCrossRunAuditNavigationView(
  summaries: CrossRunAuditResults,
  drilldowns: CrossRunAuditDrilldownResults,
): CrossRunAuditNavigationView {
  return {
    drilldowns: drilldowns.results.map((result) => ({
      links: {
        auditView: createRunAuditViewLink(result.runId),
      },
      result,
    })),
    filters: {
      drilldown: drilldowns.filters,
      summary: summaries.filters,
    },
    isConstrained: drilldowns.isConstrained,
    summaries: summaries.results.map((result) => ({
      links: {
        auditView: createRunAuditViewLink(result.runId),
        drilldowns: createDrilldownLinks(result),
      },
      result,
    })),
    totalDrilldownCount: drilldowns.totalCount,
    totalMatchedEntryCount: drilldowns.totalMatchedEntryCount,
    totalSummaryCount: summaries.totalCount,
  };
}

function createRunAuditViewLink(runId: RunId): RunAuditViewLink {
  return {
    kind: "run-audit-view",
    label: "Run audit view",
    runId,
    summary: `Open the existing run-scoped audit view for run ${runId}.`,
  };
}

function createDrilldownLinks(
  result: CrossRunAuditResult,
): readonly CrossRunAuditDrilldownLink[] {
  const links: CrossRunAuditDrilldownLink[] = [
    {
      filters: {
        runId: result.runId,
      },
      kind: "audit-drilldown",
      label: `Run ${result.runId}`,
      runId: result.runId,
      summary: `Drill down into all correlated audit facts for run ${result.runId}.`,
    },
    ...result.approvals.map((approval) =>
      createDrilldownLink(
        result.runId,
        `Approval ${approval.approvalId}`,
        `Drill down into facts correlated to approval ${approval.approvalId}.`,
        {
          approvalId: approval.approvalId,
        },
      ),
    ),
    ...result.dispatchJobs.map((dispatchJob) =>
      createDrilldownLink(
        result.runId,
        `Dispatch ${dispatchJob.dispatchJobId}`,
        `Drill down into facts correlated to dispatch job ${dispatchJob.dispatchJobId}.`,
        {
          dispatchJobId: dispatchJob.dispatchJobId,
        },
      ),
    ),
    ...result.stepIds.map((stepId) =>
      createDrilldownLink(
        result.runId,
        `Step ${stepId}`,
        `Drill down into facts correlated to step ${stepId}.`,
        {
          stepId,
        },
      ),
    ),
    ...result.toolCalls.map((toolCall) =>
      createDrilldownLink(
        result.runId,
        `Tool call ${toolCall.callId}`,
        `Drill down into facts correlated to tool call ${toolCall.callId}.`,
        {
          toolCallId: toolCall.callId,
        },
      ),
    ),
    ...toSortedValues(
      result.toolCalls
        .map((toolCall) => toolCall.toolId)
        .filter((toolId): toolId is string => typeof toolId === "string"),
    ).map((toolId) =>
      createDrilldownLink(
        result.runId,
        `Tool ${toolId}`,
        `Drill down into facts correlated to tool ${toolId}.`,
        {
          toolId,
        },
      ),
    ),
    ...result.workerIds.map((workerId) =>
      createDrilldownLink(
        result.runId,
        `Worker ${workerId}`,
        `Drill down into facts correlated to worker ${workerId}.`,
        {
          workerId,
        },
      ),
    ),
  ];

  return [...dedupeLinks(links)].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

function createDrilldownLink(
  runId: RunId,
  label: string,
  summary: string,
  filters: CrossRunAuditDrilldownFilters,
): CrossRunAuditDrilldownLink {
  return {
    filters,
    kind: "audit-drilldown",
    label,
    runId,
    summary,
  };
}

function dedupeLinks(
  links: readonly CrossRunAuditDrilldownLink[],
): readonly CrossRunAuditDrilldownLink[] {
  const uniqueLinks = new Map<string, CrossRunAuditDrilldownLink>();

  for (const link of links) {
    uniqueLinks.set(
      `${link.kind}:${link.label}:${JSON.stringify(link.filters)}`,
      link,
    );
  }

  return [...uniqueLinks.values()];
}

function toSortedValues<TValue extends string>(
  values: readonly TValue[],
): readonly TValue[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
