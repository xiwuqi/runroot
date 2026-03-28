import { describe, expect, it } from "vitest";

import { createInMemoryDispatchQueue } from "./queue";

describe("@runroot/dispatch", () => {
  it("claims the oldest queued job first", async () => {
    const queue = createInMemoryDispatchQueue({
      idGenerator: (() => {
        let nextId = 0;

        return () => `dispatch_${++nextId}`;
      })(),
    });

    await queue.enqueue({
      definitionId: "workflow.alpha",
      enqueuedAt: "2026-03-28T00:00:01.000Z",
      kind: "start_run",
      runId: "run_2",
    });
    await queue.enqueue({
      definitionId: "workflow.alpha",
      enqueuedAt: "2026-03-28T00:00:00.000Z",
      kind: "start_run",
      runId: "run_1",
    });

    const claimed = await queue.claimNext({
      claimedAt: "2026-03-28T00:00:02.000Z",
      workerId: "worker_1",
    });

    expect(claimed?.runId).toBe("run_1");
    expect(claimed?.status).toBe("claimed");
  });

  it("marks jobs completed and failed without losing history", async () => {
    const queue = createInMemoryDispatchQueue({
      idGenerator: () => "dispatch_fixed",
    });

    const queuedJob = await queue.enqueue({
      definitionId: "workflow.alpha",
      enqueuedAt: "2026-03-28T00:00:00.000Z",
      kind: "resume_run",
      runId: "run_1",
    });

    await queue.claimNext({
      claimedAt: "2026-03-28T00:00:01.000Z",
      workerId: "worker_1",
    });
    const completedJob = await queue.complete(
      queuedJob.id,
      "2026-03-28T00:00:02.000Z",
    );
    const failedJob = await queue.fail(
      queuedJob.id,
      "2026-03-28T00:00:03.000Z",
      "unexpected worker failure",
    );

    expect(completedJob?.status).toBe("completed");
    expect(failedJob?.status).toBe("failed");
    expect(failedJob?.failureMessage).toContain("worker failure");
  });
});
