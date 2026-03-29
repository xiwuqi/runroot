import { describe, expect, it } from "vitest";

import { createCrossRunAuditQuery } from "./query";

describe("@runroot/replay cross-run audit query", () => {
  it("returns thin cross-run summaries for inline and queued runs", async () => {
    const query = createCrossRunAuditQuery({
      async listByRunId(runId) {
        switch (runId) {
          case "run_inline":
            return [
              {
                id: "event_inline_1",
                name: "run.started",
                occurredAt: "2026-03-28T10:00:00.000Z",
                payload: {
                  fromStatus: "pending",
                  toStatus: "running",
                },
                runId,
                sequence: 1,
              },
              {
                id: "event_inline_2",
                name: "run.succeeded",
                occurredAt: "2026-03-28T10:00:03.000Z",
                payload: {
                  completedStepCount: 1,
                  status: "succeeded",
                },
                runId,
                sequence: 2,
              },
            ];
          case "run_queued":
            return [
              {
                id: "event_queued_1",
                name: "run.queued",
                occurredAt: "2026-03-28T11:00:00.000Z",
                payload: {
                  fromStatus: "pending",
                  toStatus: "queued",
                },
                runId,
                sequence: 1,
              },
              {
                id: "event_queued_2",
                name: "approval.requested",
                occurredAt: "2026-03-28T11:00:01.000Z",
                payload: {
                  approvalId: "approval_1",
                  reviewerId: "ops-oncall",
                  status: "pending",
                },
                runId,
                sequence: 2,
                stepId: "step_review",
              },
              {
                id: "event_queued_3",
                name: "approval.approved",
                occurredAt: "2026-03-28T11:00:03.000Z",
                payload: {
                  actorId: "ops-oncall",
                  approvalId: "approval_1",
                  decision: "approved",
                  status: "approved",
                },
                runId,
                sequence: 3,
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
                availableAt: "2026-03-28T11:00:00.000Z",
                claimedAt: "2026-03-28T11:00:01.500Z",
                claimedBy: "worker_1",
                completedAt: "2026-03-28T11:00:04.000Z",
                definitionId: "slack-approval-flow",
                enqueuedAt: "2026-03-28T11:00:00.000Z",
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
            createdAt: "2026-03-28T10:00:00.000Z",
            currentStepIndex: 1,
            definitionId: "shell-runbook-flow",
            definitionName: "Shell runbook flow",
            definitionVersion: "1.0.0",
            id: "run_inline",
            input: {
              commandAlias: "print-ready",
            },
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
            updatedAt: "2026-03-28T10:00:03.000Z",
          },
          {
            createdAt: "2026-03-28T11:00:00.000Z",
            currentStepIndex: 2,
            definitionId: "slack-approval-flow",
            definitionName: "Slack approval flow",
            definitionVersion: "1.0.0",
            id: "run_queued",
            input: {
              operation: "deploy staging",
            },
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
            updatedAt: "2026-03-28T11:00:05.000Z",
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
                finishedAt: "2026-03-28T10:00:02.000Z",
                inputSummary: "object(keys=action)",
                outcome: "succeeded",
                outputSummary: "object(keys=stdout)",
                runId,
                source: "template:step",
                startedAt: "2026-03-28T10:00:01.000Z",
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
                finishedAt: "2026-03-28T11:00:04.500Z",
                inputSummary: "object(keys=channel,summary)",
                outcome: "succeeded",
                outputSummary: "object(keys=messageId)",
                runId,
                source: "template:step",
                startedAt: "2026-03-28T11:00:04.000Z",
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

    const results = await query.listAuditResults();

    expect(results.totalCount).toBe(2);
    expect(results.results[0]).toMatchObject({
      approvals: [
        {
          approvalId: "approval_1",
          status: "approved",
          stepId: "step_review",
        },
      ],
      dispatchJobs: [
        {
          dispatchJobId: "dispatch_1",
          kind: "start_run",
          status: "completed",
          workerId: "worker_1",
        },
      ],
      executionModes: ["queued"],
      runId: "run_queued",
      toolCalls: [
        {
          callId: "call_queued_1",
          dispatchJobId: "dispatch_1",
          executionMode: "queued",
          stepId: "step_notify",
          toolId: "builtin.slack.notify",
          toolName: "slack.notify",
          workerId: "worker_1",
        },
      ],
      workerIds: ["worker_1"],
    });
    expect(results.results[1]).toMatchObject({
      executionModes: ["inline"],
      runId: "run_inline",
      toolCalls: [
        {
          callId: "call_inline_1",
          executionMode: "inline",
          toolName: "shell.runbook",
        },
      ],
    });
  });

  it("filters cross-run results by execution mode and tool name", async () => {
    const query = createCrossRunAuditQuery({
      async listByRunId(runId) {
        return [
          {
            id: `${runId}_event_1`,
            name: "run.succeeded",
            occurredAt:
              runId === "run_inline"
                ? "2026-03-28T12:00:01.000Z"
                : "2026-03-28T12:00:02.000Z",
            payload: {
              completedStepCount: 1,
              status: "succeeded",
            },
            runId,
            sequence: 1,
          },
        ];
      },
      async listDispatchJobsByRunId(runId) {
        return runId === "run_queued"
          ? [
              {
                attempts: 1,
                availableAt: "2026-03-28T12:00:00.000Z",
                definitionId: "slack-approval-flow",
                enqueuedAt: "2026-03-28T12:00:00.000Z",
                id: "dispatch_queued",
                kind: "start_run",
                runId,
                status: "queued",
              },
            ]
          : [];
      },
      async listRuns() {
        return [
          {
            createdAt: "2026-03-28T12:00:00.000Z",
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
            updatedAt: "2026-03-28T12:00:01.000Z",
          },
          {
            createdAt: "2026-03-28T12:00:00.000Z",
            currentStepIndex: 1,
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
            updatedAt: "2026-03-28T12:00:02.000Z",
          },
        ];
      },
      async listToolHistoryByRunId(runId) {
        return [
          {
            callId: `${runId}_call_1`,
            executionMode: runId === "run_inline" ? "inline" : "queued",
            finishedAt:
              runId === "run_inline"
                ? "2026-03-28T12:00:01.000Z"
                : "2026-03-28T12:00:02.000Z",
            inputSummary: "object(empty)",
            outcome: "succeeded",
            runId,
            source: "template:step",
            startedAt:
              runId === "run_inline"
                ? "2026-03-28T12:00:00.500Z"
                : "2026-03-28T12:00:01.500Z",
            toolId:
              runId === "run_inline"
                ? "builtin.shell.runbook"
                : "builtin.slack.notify",
            toolName: runId === "run_inline" ? "shell.runbook" : "slack.notify",
            toolSource: "builtin",
          },
        ];
      },
    });

    const queuedResults = await query.listAuditResults({
      executionMode: "queued",
    });
    const slackResults = await query.listAuditResults({
      toolName: "slack.notify",
    });

    expect(queuedResults.results.map((result) => result.runId)).toEqual([
      "run_queued",
    ]);
    expect(slackResults.results.map((result) => result.runId)).toEqual([
      "run_queued",
    ]);
  });
});
