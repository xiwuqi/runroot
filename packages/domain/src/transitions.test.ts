import { describe, expect, it } from "vitest";

import { serializeError } from "./failure";
import { resolveRetryPolicy } from "./retry-policy";
import { createWorkflowRunSnapshot } from "./run";
import { createWorkflowStepSnapshot } from "./step";
import {
  advanceRunCursor,
  replaceRunStep,
  transitionRunStatus,
  transitionStepStatus,
} from "./transitions";

const retryPolicy = resolveRetryPolicy({
  delayMs: 250,
  maxAttempts: 3,
});

function createSampleRun() {
  const createdAt = "2026-03-27T00:00:00.000Z";
  const step = createWorkflowStepSnapshot({
    createdAt,
    id: "step_1",
    index: 0,
    key: "prepare",
    name: "Prepare",
    retryPolicy,
    runId: "run_1",
  });

  return createWorkflowRunSnapshot({
    createdAt,
    definitionId: "workflow.prepare",
    definitionName: "Prepare workflow",
    definitionVersion: "0.1.0",
    id: "run_1",
    input: {
      source: "test",
    },
    retryPolicy,
    steps: [step],
  });
}

describe("@runroot/domain transitions", () => {
  it("moves a run from pending to queued to running", () => {
    const queuedRun = transitionRunStatus(
      createSampleRun(),
      "queued",
      "2026-03-27T00:00:01.000Z",
    );
    const runningRun = transitionRunStatus(
      queuedRun,
      "running",
      "2026-03-27T00:00:02.000Z",
    );

    expect(runningRun.status).toBe("running");
    expect(runningRun.startedAt).toBe("2026-03-27T00:00:02.000Z");
  });

  it("records a completed step and final run output", () => {
    const run = createSampleRun();
    const initialStep = run.steps[0];

    expect(initialStep).toBeDefined();

    if (!initialStep) {
      throw new Error("Expected sample run to include a step.");
    }

    const runningStep = transitionStepStatus(
      initialStep,
      "running",
      "2026-03-27T00:00:03.000Z",
    );
    const completedStep = transitionStepStatus(
      runningStep,
      "completed",
      "2026-03-27T00:00:04.000Z",
      {
        output: {
          status: "ok",
        },
      },
    );
    const completedRun = transitionRunStatus(
      advanceRunCursor(
        replaceRunStep(run, completedStep, "2026-03-27T00:00:04.000Z"),
        1,
        "2026-03-27T00:00:04.000Z",
      ),
      "queued",
      "2026-03-27T00:00:05.000Z",
    );

    const succeededRun = transitionRunStatus(
      transitionRunStatus(completedRun, "running", "2026-03-27T00:00:06.000Z"),
      "succeeded",
      "2026-03-27T00:00:07.000Z",
    );

    expect(succeededRun.output).toEqual({
      prepare: {
        status: "ok",
      },
    });
  });

  it("rejects invalid run transitions", () => {
    expect(() =>
      transitionRunStatus(
        createSampleRun(),
        "succeeded",
        "2026-03-27T00:00:01.000Z",
      ),
    ).toThrow('Invalid run transition from "pending" to "succeeded"');
  });

  it("records retry and terminal failure step transitions", () => {
    const run = createSampleRun();
    const initialStep = run.steps[0];

    expect(initialStep).toBeDefined();

    if (!initialStep) {
      throw new Error("Expected sample run to include a step.");
    }

    const runningStep = transitionStepStatus(
      initialStep,
      "running",
      "2026-03-27T00:00:01.000Z",
    );

    const retryStep = transitionStepStatus(
      runningStep,
      "retry_scheduled",
      "2026-03-27T00:00:02.000Z",
      {
        error: serializeError(new Error("transient"), true),
      },
    );

    const terminalFailure = transitionStepStatus(
      transitionStepStatus(retryStep, "ready", "2026-03-27T00:00:03.000Z"),
      "running",
      "2026-03-27T00:00:04.000Z",
    );

    const failedStep = transitionStepStatus(
      terminalFailure,
      "failed",
      "2026-03-27T00:00:05.000Z",
      {
        error: serializeError(new Error("fatal"), false),
      },
    );

    expect(retryStep.status).toBe("retry_scheduled");
    expect(retryStep.lastError?.retryable).toBe(true);
    expect(failedStep.status).toBe("failed");
    expect(failedStep.lastError?.retryable).toBe(false);
  });
});
