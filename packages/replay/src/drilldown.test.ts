import { describe, expect, it } from "vitest";

import { createCrossRunAuditDrilldownQuery } from "./query";

describe("@runroot/replay cross-run audit drilldown query", () => {
  it("returns constrained identifier-driven drilldowns for inline and queued runs", async () => {
    const query = createCrossRunAuditDrilldownQuery({
      async listByRunId(runId) {
        switch (runId) {
          case "run_inline":
            return [
              {
                id: "event_inline_1",
                name: "run.started",
                occurredAt: "2026-03-28T14:00:00.000Z",
                payload: {
                  fromStatus: "pending",
                  toStatus: "running",
                },
                runId,
                sequence: 1,
              },
              {
                id: "event_inline_2",
                name: "step.completed",
                occurredAt: "2026-03-28T14:00:03.000Z",
                payload: {
                  attempt: 1,
                  status: "completed",
                },
                runId,
                sequence: 2,
                stepId: "step_execute",
              },
            ];
          case "run_queued":
            return [
              {
                id: "event_queued_1",
                name: "approval.requested",
                occurredAt: "2026-03-28T15:00:01.000Z",
                payload: {
                  approvalId: "approval_1",
                  status: "pending",
                },
                runId,
                sequence: 1,
                stepId: "step_review",
              },
              {
                id: "event_queued_2",
                name: "approval.approved",
                occurredAt: "2026-03-28T15:00:03.000Z",
                payload: {
                  approvalId: "approval_1",
                  status: "approved",
                },
                runId,
                sequence: 2,
                stepId: "step_review",
              },
            ];
          default:
            return [];
        }
      },
      async listDispatchJobsByRunId(runId) {
        return runId === "run_queued"
          ? [
              {
                attempts: 1,
                availableAt: "2026-03-28T15:00:00.000Z",
                claimedAt: "2026-03-28T15:00:01.500Z",
                claimedBy: "worker_1",
                completedAt: "2026-03-28T15:00:04.000Z",
                definitionId: "slack-approval-flow",
                enqueuedAt: "2026-03-28T15:00:00.000Z",
                id: "dispatch_1",
                kind: "start_run",
                runId,
                status: "completed",
              },
            ]
          : [];
      },
      async listRuns() {
        return [
          {
            createdAt: "2026-03-28T14:00:00.000Z",
            currentStepIndex: 1,
            definitionId: "shell-runbook-flow",
            definitionName: "Shell runbook flow",
            definitionVersion: "1.0.0",
            id: "run_inline",
            input: {},
            metadata: {},
            retryPolicy: {
              backoffMultiplier: 2,
              delayMs: 0,
              maxAttempts: 1,
              maxDelayMs: 30_000,
              strategy: "constant",
            },
            status: "succeeded",
            steps: [],
            updatedAt: "2026-03-28T14:00:03.000Z",
          },
          {
            createdAt: "2026-03-28T15:00:00.000Z",
            currentStepIndex: 2,
            definitionId: "slack-approval-flow",
            definitionName: "Slack approval flow",
            definitionVersion: "1.0.0",
            id: "run_queued",
            input: {},
            metadata: {},
            retryPolicy: {
              backoffMultiplier: 2,
              delayMs: 0,
              maxAttempts: 1,
              maxDelayMs: 30_000,
              strategy: "constant",
            },
            status: "succeeded",
            steps: [],
            updatedAt: "2026-03-28T15:00:05.000Z",
          },
        ];
      },
      async listToolHistoryByRunId(runId) {
        switch (runId) {
          case "run_inline":
            return [
              {
                callId: "call_inline_1",
                executionMode: "inline",
                finishedAt: "2026-03-28T14:00:02.000Z",
                inputSummary: "object(keys=action)",
                outcome: "succeeded",
                outputSummary: "object(keys=stdout)",
                runId,
                source: "template:step",
                startedAt: "2026-03-28T14:00:01.000Z",
                stepId: "step_execute",
                toolId: "builtin.shell.runbook",
                toolName: "shell.runbook",
                toolSource: "builtin",
              },
            ];
          case "run_queued":
            return [
              {
                callId: "call_queued_1",
                dispatchJobId: "dispatch_1",
                executionMode: "queued",
                finishedAt: "2026-03-28T15:00:04.500Z",
                inputSummary: "object(keys=channel,summary)",
                outcome: "succeeded",
                outputSummary: "object(keys=messageId)",
                runId,
                source: "template:step",
                startedAt: "2026-03-28T15:00:04.000Z",
                stepId: "step_notify",
                toolId: "builtin.slack.notify",
                toolName: "slack.notify",
                toolSource: "builtin",
                workerId: "worker_1",
              },
            ];
          default:
            return [];
        }
      },
    });

    const workerDrilldowns = await query.listAuditDrilldowns({
      workerId: "worker_1",
    });
    const stepDrilldowns = await query.listAuditDrilldowns({
      stepId: "step_execute",
    });

    expect(workerDrilldowns.isConstrained).toBe(true);
    expect(workerDrilldowns.totalCount).toBe(1);
    expect(workerDrilldowns.totalMatchedEntryCount).toBe(4);
    expect(workerDrilldowns.results[0]).toMatchObject({
      identifiers: {
        dispatchJobIds: ["dispatch_1"],
        workerIds: ["worker_1"],
      },
      runId: "run_queued",
    });
    expect(
      workerDrilldowns.results[0]?.entries.map((entry) => entry.kind),
    ).toEqual([
      "dispatch-enqueued",
      "dispatch-claimed",
      "dispatch-completed",
      "tool-outcome",
    ]);

    expect(stepDrilldowns.totalCount).toBe(1);
    expect(stepDrilldowns.results[0]).toMatchObject({
      identifiers: {
        stepIds: ["step_execute"],
        toolIds: ["builtin.shell.runbook"],
      },
      runId: "run_inline",
    });
    expect(
      stepDrilldowns.results[0]?.entries.map((entry) => entry.kind),
    ).toEqual(["tool-outcome", "replay-event"]);
  });

  it("stays constrained when no identifier filter is provided", async () => {
    const query = createCrossRunAuditDrilldownQuery({
      async listByRunId() {
        return [];
      },
      async listDispatchJobsByRunId() {
        return [];
      },
      async listRuns() {
        return [];
      },
      async listToolHistoryByRunId() {
        return [];
      },
    });

    const results = await query.listAuditDrilldowns();

    expect(results).toEqual({
      filters: {},
      isConstrained: false,
      results: [],
      totalCount: 0,
      totalMatchedEntryCount: 0,
    });
  });
});
