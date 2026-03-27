import { transitionRunStatus } from "@runroot/domain";
import { createInMemoryRuntimePersistence } from "@runroot/persistence";
import { describe, expect, it } from "vitest";

import { RuntimeEngine, RuntimeExecutionError } from "./runtime-engine";

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

describe("@runroot/core-runtime createRun", () => {
  it("creates a persisted run with initial events and checkpoint", async () => {
    const persistence = createInMemoryRuntimePersistence({
      idGenerator: (prefix) => `${prefix}_event`,
    });
    const runtime = new RuntimeEngine({
      idGenerator: createIdGenerator(),
      now: createClock(),
      persistence,
    });

    const run = await runtime.createRun(
      {
        id: "workflow.bootstrap",
        name: "Bootstrap workflow",
        steps: [
          {
            execute: () => undefined,
            key: "prepare",
            name: "Prepare",
          },
        ],
        version: "0.1.0",
      },
      {
        trigger: "test",
      },
    );

    const checkpoints = await runtime.getCheckpoints(run.id);
    const events = await runtime.getRunEvents(run.id);

    expect(run.status).toBe("pending");
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0]?.status).toBe("ready");
    expect(events.map((event) => event.name)).toEqual([
      "run.created",
      "step.ready",
      "checkpoint.saved",
    ]);
    expect(checkpoints[0]?.reason).toBe("run_created");
  });

  it("does not persist a partial run when the atomic transition commit fails", async () => {
    const persistence = createInMemoryRuntimePersistence({
      idGenerator: (prefix) => {
        if (prefix === "checkpoint") {
          throw new Error("checkpoint unavailable");
        }

        return `${prefix}_event`;
      },
    });
    const runtime = new RuntimeEngine({
      idGenerator: createIdGenerator(),
      now: createClock(),
      persistence,
    });

    await expect(
      runtime.createRun(
        {
          id: "workflow.atomic",
          name: "Atomic workflow",
          steps: [
            {
              execute: () => undefined,
              key: "prepare",
              name: "Prepare",
            },
          ],
          version: "0.1.0",
        },
        {
          trigger: "atomic-test",
        },
        {
          runId: "run_atomic",
        },
      ),
    ).rejects.toThrow("checkpoint unavailable");

    expect(await runtime.getRun("run_atomic")).toBeUndefined();
    expect(await runtime.getRunEvents("run_atomic")).toEqual([]);
    expect(await runtime.getCheckpoints("run_atomic")).toEqual([]);
  });

  it("rejects pauseRun while a run is still pending", async () => {
    const persistence = createInMemoryRuntimePersistence();
    const runtime = new RuntimeEngine({
      idGenerator: createIdGenerator(),
      now: createClock(),
      persistence,
    });
    const run = await runtime.createRun(
      {
        id: "workflow.pause.pending",
        name: "Pending pause workflow",
        steps: [
          {
            execute: () => undefined,
            key: "prepare",
            name: "Prepare",
          },
        ],
        version: "0.1.0",
      },
      {
        trigger: "pause-pending",
      },
    );

    await expect(runtime.pauseRun(run.id, "operator request")).rejects.toThrow(
      RuntimeExecutionError,
    );
    await expect(runtime.pauseRun(run.id, "operator request")).rejects.toThrow(
      'Run "run_1" has not started.',
    );

    expect((await runtime.getRun(run.id))?.status).toBe("pending");
    expect(
      (await runtime.getRunEvents(run.id)).some(
        (event) => event.name === "run.paused",
      ),
    ).toBe(false);
  });

  it("pauses a queued run and persists the pause checkpoint atomically", async () => {
    const persistence = createInMemoryRuntimePersistence();
    const runtime = new RuntimeEngine({
      idGenerator: createIdGenerator(),
      now: createClock(),
      persistence,
    });
    const run = await runtime.createRun(
      {
        id: "workflow.pause.queued",
        name: "Queued pause workflow",
        steps: [
          {
            execute: () => undefined,
            key: "prepare",
            name: "Prepare",
          },
        ],
        version: "0.1.0",
      },
      {
        trigger: "pause-queued",
      },
    );
    const queuedRun = transitionRunStatus(
      run,
      "queued",
      "2026-03-27T00:00:03.000Z",
    );

    await persistence.runs.put(queuedRun);

    const pausedRun = await runtime.pauseRun(run.id, "operator request");
    const checkpoints = await runtime.getCheckpoints(run.id);
    const events = await runtime.getRunEvents(run.id);

    expect(pausedRun.status).toBe("paused");
    expect(pausedRun.pauseReason).toBe("operator request");
    expect(checkpoints.at(-1)?.reason).toBe("run_paused");
    expect(events.at(-2)?.name).toBe("run.paused");
    expect(events.at(-1)?.name).toBe("checkpoint.saved");
  });

  it("rejects resumeRun when the run is not paused", async () => {
    const persistence = createInMemoryRuntimePersistence();
    const runtime = new RuntimeEngine({
      idGenerator: createIdGenerator(),
      now: createClock(),
      persistence,
    });
    const definition = {
      id: "workflow.resume.invalid",
      name: "Invalid resume workflow",
      steps: [
        {
          execute: () => undefined,
          key: "prepare",
          name: "Prepare",
        },
      ],
      version: "0.1.0",
    };
    const run = await runtime.createRun(definition, {
      trigger: "resume-invalid",
    });

    await expect(runtime.resumeRun(definition, run.id)).rejects.toThrow(
      RuntimeExecutionError,
    );
    await expect(runtime.resumeRun(definition, run.id)).rejects.toThrow(
      `Run "${run.id}" is not paused and cannot be resumed.`,
    );
  });

  it("rejects approval decisions for unknown approval ids", async () => {
    const persistence = createInMemoryRuntimePersistence();
    const runtime = new RuntimeEngine({
      idGenerator: createIdGenerator(),
      now: createClock(),
      persistence,
    });

    await expect(
      runtime.decideApproval("approval_missing", {
        decision: "approved",
      }),
    ).rejects.toThrow(RuntimeExecutionError);
    await expect(
      runtime.decideApproval("approval_missing", {
        decision: "approved",
      }),
    ).rejects.toThrow('Approval "approval_missing" was not found.');
  });
});
