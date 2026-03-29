import type { DispatchJob } from "@runroot/dispatch";
import type { RunId, WorkflowRun } from "@runroot/domain";
import type { RuntimeEvent } from "@runroot/events";
import type { ToolHistoryEntry } from "@runroot/tools";

import { projectRunAuditView, type RunAuditView } from "./audit";
import {
  type CrossRunAuditQueryFilters,
  type CrossRunAuditResults,
  compareCrossRunAuditResults,
  matchesCrossRunAuditFilters,
  projectCrossRunAuditResult,
} from "./cross-run";
import {
  type CrossRunAuditDrilldownFilters,
  type CrossRunAuditDrilldownResults,
  compareCrossRunAuditDrilldownResults,
  hasCrossRunAuditDrilldownFilters,
  projectCrossRunAuditDrilldownResult,
} from "./drilldown";
import { projectRunTimeline, type RunTimeline } from "./timeline";

export interface RunTimelineReader {
  listByRunId(runId: RunId): Promise<RuntimeEvent[]>;
}

export interface RunAuditReader extends RunTimelineReader {
  listDispatchJobsByRunId(runId: RunId): Promise<readonly DispatchJob[]>;
  listToolHistoryByRunId(runId: RunId): Promise<readonly ToolHistoryEntry[]>;
}

export interface CrossRunAuditReader extends RunAuditReader {
  listRuns(): Promise<readonly WorkflowRun[]>;
}

export interface RunTimelineQuery {
  getTimeline(runId: RunId): Promise<RunTimeline>;
}

export interface RunAuditQuery {
  getAuditView(runId: RunId): Promise<RunAuditView>;
}

export interface CrossRunAuditQuery {
  listAuditResults(
    filters?: CrossRunAuditQueryFilters,
  ): Promise<CrossRunAuditResults>;
}

export interface CrossRunAuditDrilldownQuery {
  listAuditDrilldowns(
    filters?: CrossRunAuditDrilldownFilters,
  ): Promise<CrossRunAuditDrilldownResults>;
}

export function createRunTimelineQuery(
  reader: RunTimelineReader,
): RunTimelineQuery {
  return {
    async getTimeline(runId) {
      const events = await reader.listByRunId(runId);

      return projectRunTimeline(runId, events);
    },
  };
}

export function createRunAuditQuery(reader: RunAuditReader): RunAuditQuery {
  return {
    async getAuditView(runId) {
      const [dispatchJobs, events, toolHistory] = await Promise.all([
        reader.listDispatchJobsByRunId(runId),
        reader.listByRunId(runId),
        reader.listToolHistoryByRunId(runId),
      ]);

      return projectRunAuditView(runId, {
        dispatchJobs,
        events,
        toolHistory,
      });
    },
  };
}

export function createCrossRunAuditQuery(
  reader: CrossRunAuditReader,
): CrossRunAuditQuery {
  const auditQuery = createRunAuditQuery(reader);

  return {
    async listAuditResults(filters = {}) {
      const runs = (await reader.listRuns())
        .filter((run) => {
          if (
            filters.definitionId &&
            run.definitionId !== filters.definitionId
          ) {
            return false;
          }

          if (filters.runStatus && run.status !== filters.runStatus) {
            return false;
          }

          return true;
        })
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      const results = await Promise.all(
        runs.map(async (run) =>
          projectCrossRunAuditResult(
            run,
            await auditQuery.getAuditView(run.id),
          ),
        ),
      );
      const filteredResults = results
        .filter((result) => matchesCrossRunAuditFilters(result, filters))
        .sort(compareCrossRunAuditResults);

      return {
        filters,
        results: filteredResults,
        totalCount: filteredResults.length,
      };
    },
  };
}

export function createCrossRunAuditDrilldownQuery(
  reader: CrossRunAuditReader,
): CrossRunAuditDrilldownQuery {
  const auditQuery = createRunAuditQuery(reader);

  return {
    async listAuditDrilldowns(filters = {}) {
      if (!hasCrossRunAuditDrilldownFilters(filters)) {
        return {
          filters,
          isConstrained: false,
          results: [],
          totalCount: 0,
          totalMatchedEntryCount: 0,
        };
      }

      const runs = (await reader.listRuns())
        .filter((run) => (filters.runId ? run.id === filters.runId : true))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      const results = (
        await Promise.all(
          runs.map(async (run) =>
            projectCrossRunAuditDrilldownResult(
              run,
              await auditQuery.getAuditView(run.id),
              filters,
            ),
          ),
        )
      )
        .filter(
          (result): result is NonNullable<typeof result> =>
            result !== undefined,
        )
        .sort(compareCrossRunAuditDrilldownResults);

      return {
        filters,
        isConstrained: true,
        results,
        totalCount: results.length,
        totalMatchedEntryCount: results.reduce(
          (count, result) => count + result.matchedEntryCount,
          0,
        ),
      };
    },
  };
}
