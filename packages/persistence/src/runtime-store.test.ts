import {
  createWorkflowRunSnapshot,
  createWorkflowStepSnapshot,
  resolveRetryPolicy,
} from "@runroot/domain";
import { describe, expect, it } from "vitest";

import { createInMemoryRuntimePersistence } from "./runtime-store";

function createRun(runId = "run_1") {
  const createdAt = "2026-03-27T00:00:00.000Z";
  const retryPolicy = resolveRetryPolicy({
    delayMs: 100,
    maxAttempts: 2,
  });
  const step = createWorkflowStepSnapshot({
    createdAt,
    id: "step_1",
    index: 0,
    key: "prepare",
    name: "Prepare",
    retryPolicy,
    runId,
  });

  return createWorkflowRunSnapshot({
    createdAt,
    definitionId: "workflow.prepare",
    definitionName: "Prepare workflow",
    definitionVersion: "0.1.0",
    id: runId,
    input: {
      trigger: "test",
    },
    retryPolicy,
    steps: [step],
  });
}

describe("@runroot/persistence in-memory store", () => {
  it("commits a run, events, and checkpoint atomically with ordered sequences", async () => {
    const run = createRun();
    const firstStep = run.steps[0];
    const persistence = createInMemoryRuntimePersistence({
      idGenerator: (prefix) => `${prefix}_fixed`,
    });

    expect(firstStep).toBeDefined();

    if (!firstStep) {
      throw new Error("Expected persistence test run to include a step.");
    }

    const result = await persistence.commitTransition({
      checkpoint: {
        attempt: 0,
        createdAt: "2026-03-27T00:00:00.000Z",
        nextStepIndex: 0,
        reason: "run_created",
        runId: run.id,
        stepId: firstStep.id,
      },
      events: [
        {
          name: "run.created",
          occurredAt: "2026-03-27T00:00:00.000Z",
          payload: {
            definitionId: run.definitionId,
            status: run.status,
          },
          runId: run.id,
        },
      ],
      run,
    });

    expect(result.events.map((event) => event.name)).toEqual([
      "run.created",
      "checkpoint.saved",
    ]);
    expect(result.events.map((event) => event.sequence)).toEqual([1, 2]);
    expect(result.checkpoint?.sequence).toBe(1);
    expect(await persistence.runs.get(run.id)).toEqual(run);
    expect(await persistence.checkpoints.getLatestByRunId(run.id)).toEqual(
      result.checkpoint,
    );
  });

  it("does not persist partial state when checkpoint creation fails", async () => {
    const run = createRun("run_atomic");
    const persistence = createInMemoryRuntimePersistence({
      idGenerator: (prefix) => {
        if (prefix === "checkpoint") {
          throw new Error("checkpoint id failed");
        }

        return `${prefix}_fixed`;
      },
    });

    await expect(
      persistence.commitTransition({
        checkpoint: {
          attempt: 0,
          createdAt: "2026-03-27T00:00:00.000Z",
          nextStepIndex: 0,
          reason: "run_created",
          runId: run.id,
        },
        events: [
          {
            name: "run.created",
            occurredAt: "2026-03-27T00:00:00.000Z",
            payload: {
              definitionId: run.definitionId,
              status: run.status,
            },
            runId: run.id,
          },
        ],
        run,
      }),
    ).rejects.toThrow("checkpoint id failed");

    expect(await persistence.runs.get(run.id)).toBeUndefined();
    expect(await persistence.events.listByRunId(run.id)).toEqual([]);
    expect(await persistence.checkpoints.listByRunId(run.id)).toEqual([]);
  });
});
