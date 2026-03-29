import type { RunId, RunStatus, StepId, WorkflowRun } from "@runroot/domain";

import type { RunAuditEntry, RunAuditView } from "./audit";

export interface CrossRunAuditDrilldownFilters {
  readonly approvalId?: string;
  readonly dispatchJobId?: string;
  readonly runId?: RunId;
  readonly stepId?: StepId;
  readonly toolCallId?: string;
  readonly toolId?: string;
  readonly workerId?: string;
}

export interface CrossRunAuditDrilldownIdentifiers {
  readonly approvalIds: readonly string[];
  readonly dispatchJobIds: readonly string[];
  readonly runIds: readonly RunId[];
  readonly stepIds: readonly StepId[];
  readonly toolCallIds: readonly string[];
  readonly toolIds: readonly string[];
  readonly workerIds: readonly string[];
}

export interface CrossRunAuditDrilldownResult {
  readonly definitionId: string;
  readonly definitionName: string;
  readonly entries: readonly RunAuditEntry[];
  readonly identifiers: CrossRunAuditDrilldownIdentifiers;
  readonly lastOccurredAt?: string;
  readonly matchedEntryCount: number;
  readonly runId: RunId;
  readonly runStatus: RunStatus;
  readonly summary: string;
  readonly updatedAt: string;
}

export interface CrossRunAuditDrilldownResults {
  readonly filters: CrossRunAuditDrilldownFilters;
  readonly isConstrained: boolean;
  readonly results: readonly CrossRunAuditDrilldownResult[];
  readonly totalCount: number;
  readonly totalMatchedEntryCount: number;
}

export function hasCrossRunAuditDrilldownFilters(
  filters: CrossRunAuditDrilldownFilters,
): boolean {
  return (
    filters.runId !== undefined ||
    filters.approvalId !== undefined ||
    filters.stepId !== undefined ||
    filters.dispatchJobId !== undefined ||
    filters.workerId !== undefined ||
    filters.toolCallId !== undefined ||
    filters.toolId !== undefined
  );
}

export function projectCrossRunAuditDrilldownResult(
  run: WorkflowRun,
  audit: RunAuditView,
  filters: CrossRunAuditDrilldownFilters,
): CrossRunAuditDrilldownResult | undefined {
  if (audit.runId !== run.id) {
    throw new Error(
      `Cross-run audit drilldown received audit view for run "${audit.runId}" while projecting run "${run.id}".`,
    );
  }

  const matchedEntries = audit.entries.filter((entry) =>
    matchesCrossRunAuditDrilldownFilters(entry, filters),
  );

  if (matchedEntries.length === 0) {
    return undefined;
  }

  const lastOccurredAt = matchedEntries.at(-1)?.occurredAt;

  return {
    definitionId: run.definitionId,
    definitionName: run.definitionName,
    entries: matchedEntries,
    identifiers: summarizeDrilldownIdentifiers(matchedEntries),
    ...(lastOccurredAt ? { lastOccurredAt } : {}),
    matchedEntryCount: matchedEntries.length,
    runId: run.id,
    runStatus: run.status,
    summary: `${run.definitionName} (${run.status}) matched ${matchedEntries.length} drilldown fact(s).`,
    updatedAt: run.updatedAt,
  };
}

export function matchesCrossRunAuditDrilldownFilters(
  entry: RunAuditEntry,
  filters: CrossRunAuditDrilldownFilters,
): boolean {
  if (!hasCrossRunAuditDrilldownFilters(filters)) {
    return false;
  }

  if (filters.runId && entry.correlation.runId !== filters.runId) {
    return false;
  }

  if (
    filters.approvalId &&
    entry.correlation.approvalId !== filters.approvalId
  ) {
    return false;
  }

  if (filters.stepId && entry.correlation.stepId !== filters.stepId) {
    return false;
  }

  if (
    filters.dispatchJobId &&
    entry.correlation.dispatchJobId !== filters.dispatchJobId
  ) {
    return false;
  }

  if (filters.workerId && entry.correlation.workerId !== filters.workerId) {
    return false;
  }

  if (
    filters.toolCallId &&
    entry.correlation.toolCallId !== filters.toolCallId
  ) {
    return false;
  }

  if (filters.toolId && entry.correlation.toolId !== filters.toolId) {
    return false;
  }

  return true;
}

export function compareCrossRunAuditDrilldownResults(
  left: CrossRunAuditDrilldownResult,
  right: CrossRunAuditDrilldownResult,
): number {
  return (
    (right.lastOccurredAt ?? right.updatedAt).localeCompare(
      left.lastOccurredAt ?? left.updatedAt,
    ) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.runId.localeCompare(right.runId)
  );
}

function summarizeDrilldownIdentifiers(
  entries: readonly RunAuditEntry[],
): CrossRunAuditDrilldownIdentifiers {
  return {
    approvalIds: toSortedValues(
      entries
        .map((entry) => entry.correlation.approvalId)
        .filter((value): value is string => typeof value === "string"),
    ),
    dispatchJobIds: toSortedValues(
      entries
        .map((entry) => entry.correlation.dispatchJobId)
        .filter((value): value is string => typeof value === "string"),
    ),
    runIds: toSortedValues(entries.map((entry) => entry.correlation.runId)),
    stepIds: toSortedValues(
      entries
        .map((entry) => entry.correlation.stepId)
        .filter((value): value is StepId => typeof value === "string"),
    ),
    toolCallIds: toSortedValues(
      entries
        .map((entry) => entry.correlation.toolCallId)
        .filter((value): value is string => typeof value === "string"),
    ),
    toolIds: toSortedValues(
      entries
        .map((entry) => entry.correlation.toolId)
        .filter((value): value is string => typeof value === "string"),
    ),
    workerIds: toSortedValues(
      entries
        .map((entry) => entry.correlation.workerId)
        .filter((value): value is string => typeof value === "string"),
    ),
  };
}

function toSortedValues<TValue extends string>(
  values: readonly TValue[],
): readonly TValue[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
