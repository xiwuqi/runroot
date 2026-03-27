import { describe, expect, it } from "vitest";

import { createRunTimelineQuery } from "./query";
import { projectRunTimeline } from "./timeline";

describe("@runroot/replay timeline", () => {
  it("projects persisted approval and run lifecycle events into an ordered timeline", async () => {
    const runId = "run_1";
    const query = createRunTimelineQuery({
      async listByRunId() {
        return [
          {
            id: "event_1",
            name: "run.created" as const,
            occurredAt: "2026-03-27T00:00:00.000Z",
            payload: {
              definitionId: "workflow.approval",
              status: "pending" as const,
            },
            runId,
            sequence: 1,
          },
          {
            id: "event_2",
            name: "approval.requested" as const,
            occurredAt: "2026-03-27T00:00:05.000Z",
            payload: {
              approvalId: "approval_1",
              reviewerId: "ops_1",
              status: "pending" as const,
            },
            runId,
            sequence: 2,
            stepId: "step_1",
          },
          {
            id: "event_3",
            name: "approval.approved" as const,
            occurredAt: "2026-03-27T00:01:00.000Z",
            payload: {
              actorId: "ops_1",
              approvalId: "approval_1",
              decision: "approved" as const,
              status: "approved" as const,
            },
            runId,
            sequence: 3,
            stepId: "step_1",
          },
          {
            id: "event_4",
            name: "run.resumed" as const,
            occurredAt: "2026-03-27T00:01:05.000Z",
            payload: {
              checkpointId: "checkpoint_1",
              fromStatus: "paused" as const,
              toStatus: "queued" as const,
            },
            runId,
            sequence: 4,
          },
          {
            id: "event_5",
            name: "run.succeeded" as const,
            occurredAt: "2026-03-27T00:01:30.000Z",
            payload: {
              completedStepCount: 1,
              status: "succeeded" as const,
            },
            runId,
            sequence: 5,
          },
        ];
      },
    });

    const timeline = await query.getTimeline(runId);

    expect(timeline.entries.map((entry) => entry.kind)).toEqual([
      "run-created",
      "waiting-for-approval",
      "approval-approved",
      "run-resumed",
      "run-succeeded",
    ]);
    expect(timeline.entries[1]?.eventName).toBe("approval.requested");
    expect(timeline.entries[2]?.payload).toMatchObject({
      approvalId: "approval_1",
      decision: "approved",
    });
  });

  it("rejects events that do not belong to the requested run", () => {
    expect(() =>
      projectRunTimeline("run_1", [
        {
          id: "event_1",
          name: "run.created",
          occurredAt: "2026-03-27T00:00:00.000Z",
          payload: {
            definitionId: "workflow.replay",
            status: "pending",
          },
          runId: "run_2",
          sequence: 1,
        },
      ]),
    ).toThrow('projecting run "run_1"');
  });
});
