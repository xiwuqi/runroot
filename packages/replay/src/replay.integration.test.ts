import {
  awaitApproval,
  completeStep,
  RuntimeEngine,
} from "@runroot/core-runtime";
import { createInMemoryRuntimePersistence } from "@runroot/persistence";
import { describe, expect, it } from "vitest";

import { createRunTimelineQuery } from "./query";

function createClock() {
  let tick = 0;

  return () => `2026-03-27T00:00:${String(tick++).padStart(2, "0")}.000Z`;
}

function createIdGenerator() {
  const counters = new Map<string, number>();

  return (prefix: "run" | "step") => {
    const nextCount = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, nextCount);

    return `${prefix}_${nextCount}`;
  };
}

describe("@runroot/replay integration", () => {
  it("projects a replay timeline from runtime-produced approval events", async () => {
    const persistence = createInMemoryRuntimePersistence();
    const runtime = new RuntimeEngine({
      approvalIdGenerator: () => "approval_1",
      idGenerator: createIdGenerator(),
      now: createClock(),
      persistence,
    });
    const definition = {
      id: "workflow.replay.approval",
      name: "Replay approval workflow",
      steps: [
        {
          execute: (context: { checkpoint?: { payload?: unknown } }) => {
            if (!context.checkpoint?.payload) {
              return awaitApproval({
                checkpointData: {
                  approved: true,
                },
                note: "Approve replay workflow",
                reviewer: {
                  id: "ops_1",
                },
              });
            }

            return completeStep({
              resumed: true,
            });
          },
          key: "gate",
          name: "Gate",
        },
      ],
      version: "0.1.0",
    };

    const run = await runtime.createRun(definition, {
      trigger: "replay-integration",
    });

    await runtime.executeRun(definition, run.id);
    await runtime.decideApproval("approval_1", {
      actor: {
        id: "ops_1",
      },
      decision: "approved",
      note: "Proceed",
    });
    await runtime.resumeRun(definition, run.id);

    const replay = createRunTimelineQuery({
      listByRunId: (runId) => persistence.events.listByRunId(runId),
    });
    const timeline = await replay.getTimeline(run.id);
    const kinds = timeline.entries.map((entry) => entry.kind);

    expect(kinds).toContain("waiting-for-approval");
    expect(kinds).toContain("approval-approved");
    expect(kinds).toContain("run-resumed");
    expect(kinds).toContain("run-succeeded");
    expect(kinds.indexOf("waiting-for-approval")).toBeLessThan(
      kinds.indexOf("approval-approved"),
    );
    expect(kinds.indexOf("approval-approved")).toBeLessThan(
      kinds.indexOf("run-resumed"),
    );
  });
});
