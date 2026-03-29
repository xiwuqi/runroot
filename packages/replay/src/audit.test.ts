import { describe, expect, it } from "vitest";

import { projectRunAuditView } from "./audit";

describe("@runroot/replay audit projection", () => {
  it("correlates replay, dispatch, and tool facts into one run-scoped view", () => {
    const audit = projectRunAuditView("run_1", {
      dispatchJobs: [
        {
          attempts: 1,
          availableAt: "2026-03-28T00:00:01.000Z",
          claimedAt: "2026-03-28T00:00:02.000Z",
          claimedBy: "worker_1",
          completedAt: "2026-03-28T00:00:04.000Z",
          definitionId: "shell-runbook-flow",
          enqueuedAt: "2026-03-28T00:00:01.000Z",
          id: "dispatch_1",
          kind: "start_run",
          runId: "run_1",
          status: "completed",
        },
      ],
      events: [
        {
          id: "event_1",
          name: "run.queued",
          occurredAt: "2026-03-28T00:00:00.000Z",
          payload: {
            fromStatus: "pending",
            toStatus: "queued",
          },
          runId: "run_1",
          sequence: 1,
        },
        {
          id: "event_2",
          name: "approval.requested",
          occurredAt: "2026-03-28T00:00:03.000Z",
          payload: {
            approvalId: "approval_1",
            reviewerId: "ops-oncall",
            status: "pending",
          },
          runId: "run_1",
          sequence: 2,
          stepId: "step_approval",
        },
      ],
      toolHistory: [
        {
          callId: "call_1",
          dispatchJobId: "dispatch_1",
          executionMode: "queued",
          finishedAt: "2026-03-28T00:00:05.000Z",
          inputSummary: "object(keys=action)",
          outcome: "succeeded",
          outputSummary: "object(keys=stdout)",
          runId: "run_1",
          source: "template:step",
          startedAt: "2026-03-28T00:00:04.000Z",
          stepId: "step_execute",
          toolId: "builtin.shell.runbook",
          toolName: "shell.runbook",
          toolSource: "builtin",
          workerId: "worker_1",
        },
      ],
    });

    expect(audit.entries.map((entry) => entry.kind)).toEqual([
      "replay-event",
      "dispatch-enqueued",
      "dispatch-claimed",
      "replay-event",
      "dispatch-completed",
      "tool-outcome",
    ]);
    expect(audit.entries[1]).toMatchObject({
      correlation: {
        dispatchJobId: "dispatch_1",
        runId: "run_1",
        workerId: "worker_1",
      },
      fact: {
        dispatchKind: "start_run",
        sourceOfTruth: "dispatch",
      },
      kind: "dispatch-enqueued",
    });
    expect(audit.entries[3]).toMatchObject({
      correlation: {
        approvalId: "approval_1",
        runId: "run_1",
        stepId: "step_approval",
      },
      fact: {
        eventName: "approval.requested",
        sourceOfTruth: "runtime-event",
      },
    });
    expect(audit.entries[5]).toMatchObject({
      correlation: {
        dispatchJobId: "dispatch_1",
        runId: "run_1",
        stepId: "step_execute",
        toolCallId: "call_1",
        toolId: "builtin.shell.runbook",
        workerId: "worker_1",
      },
      fact: {
        executionMode: "queued",
        outcome: "succeeded",
        sourceOfTruth: "tool-history",
        toolName: "shell.runbook",
      },
      kind: "tool-outcome",
    });
  });

  it("rejects mismatched run ids from additive facts", () => {
    expect(() =>
      projectRunAuditView("run_1", {
        dispatchJobs: [],
        events: [],
        toolHistory: [
          {
            callId: "call_1",
            finishedAt: "2026-03-28T00:00:05.000Z",
            inputSummary: "object(keys=action)",
            outcome: "succeeded",
            runId: "run_2",
            source: "template:step",
            startedAt: "2026-03-28T00:00:04.000Z",
            toolId: "builtin.shell.runbook",
            toolName: "shell.runbook",
            toolSource: "builtin",
          },
        ],
      }),
    ).toThrow(/run "run_2".*run "run_1"/);
  });
});
