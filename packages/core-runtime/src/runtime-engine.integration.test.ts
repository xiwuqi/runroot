import { createInMemoryRuntimePersistence } from "@runroot/persistence";
import {
  createEchoTool,
  createRegistryToolInvoker,
  createToolRegistry,
} from "@runroot/tools";
import { describe, expect, it } from "vitest";

import {
  awaitApproval,
  completeStep,
  pauseStep,
  type RuntimeStepContext,
} from "./runtime-definition";
import { RuntimeEngine } from "./runtime-engine";

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

describe("@runroot/core-runtime integration", () => {
  it("retries a failing step until it succeeds", async () => {
    let attempts = 0;
    const persistence = createInMemoryRuntimePersistence();
    const runtime = new RuntimeEngine({
      idGenerator: createIdGenerator(),
      now: createClock(),
      persistence,
    });

    const definition = {
      id: "workflow.retry",
      name: "Retry workflow",
      retryPolicy: {
        delayMs: 100,
        maxAttempts: 3,
        strategy: "constant" as const,
      },
      steps: [
        {
          execute: () => {
            attempts += 1;

            if (attempts < 3) {
              throw new Error("temporary failure");
            }

            return {
              kind: "completed" as const,
              output: {
                attempts,
                status: "ok",
              },
            };
          },
          key: "flaky",
          name: "Flaky step",
        },
      ],
      version: "0.1.0",
    };

    const run = await runtime.createRun(definition, {
      trigger: "test",
    });
    const completedRun = await runtime.executeRun(definition, run.id);
    const events = await runtime.getRunEvents(run.id);

    expect(completedRun.status).toBe("succeeded");
    expect(completedRun.steps[0]?.attempts).toBe(3);
    expect(
      events.filter((event) => event.name === "step.retry_scheduled"),
    ).toHaveLength(2);
    expect(events.at(-1)?.name).toBe("checkpoint.saved");
  });

  it("pauses a run and resumes it from the latest checkpoint", async () => {
    const persistence = createInMemoryRuntimePersistence();
    let gateExecutions = 0;
    let finalizeExecutions = 0;

    const definition = {
      id: "workflow.resume",
      name: "Resume workflow",
      steps: [
        {
          execute: (context: { checkpoint?: { payload?: unknown } }) => {
            gateExecutions += 1;

            if (!context.checkpoint?.payload) {
              return pauseStep("operator gate", {
                resumeToken: "continue",
              });
            }

            return {
              kind: "completed" as const,
              output: {
                gateExecutions,
                resumed: true,
              },
            };
          },
          key: "gate",
          name: "Gate",
        },
        {
          execute: () => {
            finalizeExecutions += 1;

            return {
              kind: "completed" as const,
              output: {
                finalizeExecutions,
                status: "done",
              },
            };
          },
          key: "finalize",
          name: "Finalize",
        },
      ],
      version: "0.1.0",
    };

    const runtime = new RuntimeEngine({
      idGenerator: createIdGenerator(),
      now: createClock(),
      persistence,
    });

    const run = await runtime.createRun(definition, {
      trigger: "resume-test",
    });
    const pausedRun = await runtime.executeRun(definition, run.id);

    expect(pausedRun.status).toBe("paused");
    expect(pausedRun.steps[0]?.status).toBe("paused");

    const resumedRuntime = new RuntimeEngine({
      idGenerator: createIdGenerator(),
      now: createClock(),
      persistence,
    });
    const resumedRun = await resumedRuntime.resumeRun(definition, run.id);
    const checkpoints = await resumedRuntime.getCheckpoints(run.id);

    expect(resumedRun.status).toBe("succeeded");
    expect(resumedRun.steps[0]?.attempts).toBe(2);
    expect(resumedRun.steps[1]?.status).toBe("completed");
    expect(resumedRun.output).toEqual({
      finalize: {
        finalizeExecutions: 1,
        status: "done",
      },
      gate: {
        gateExecutions: 2,
        resumed: true,
      },
    });
    expect(
      checkpoints.some((checkpoint) => checkpoint.reason === "step_paused"),
    ).toBe(true);
  });

  it("fails a run when max attempts are exhausted", async () => {
    const persistence = createInMemoryRuntimePersistence();
    const runtime = new RuntimeEngine({
      idGenerator: createIdGenerator(),
      now: createClock(),
      persistence,
    });

    const definition = {
      id: "workflow.failure",
      name: "Failure workflow",
      retryPolicy: {
        delayMs: 50,
        maxAttempts: 2,
      },
      steps: [
        {
          execute: () => {
            throw new Error("still broken");
          },
          key: "broken",
          name: "Broken",
        },
      ],
      version: "0.1.0",
    };

    const run = await runtime.createRun(definition, {
      trigger: "failure-test",
    });
    const failedRun = await runtime.executeRun(definition, run.id);
    const events = await runtime.getRunEvents(run.id);

    expect(failedRun.status).toBe("failed");
    expect(failedRun.steps[0]?.attempts).toBe(2);
    expect(events.some((event) => event.name === "run.failed")).toBe(true);
  });

  it("invokes tools through the shared tool invoker seam", async () => {
    const persistence = createInMemoryRuntimePersistence();
    const registry = createToolRegistry([createEchoTool()]);
    const runtime = new RuntimeEngine({
      idGenerator: createIdGenerator(),
      now: createClock(),
      persistence,
      toolInvoker: createRegistryToolInvoker({
        registry,
      }),
    });
    const definition = {
      id: "workflow.tools.echo",
      name: "Tool workflow",
      steps: [
        {
          execute: async (context: RuntimeStepContext) => {
            const result = await context.tools.invoke(
              {
                input: {
                  message: "ready",
                  prefix: "tool:",
                },
                tool: {
                  kind: "name",
                  value: "echo",
                },
              },
              {
                runId: context.run.id,
                source: "runtime",
                stepId: context.step.id,
              },
            );

            return completeStep(result.output);
          },
          key: "prepare",
          name: "Prepare",
        },
      ],
      version: "0.1.0",
    };

    const run = await runtime.createRun(definition, {
      trigger: "tool-test",
    });
    const completedRun = await runtime.executeRun(definition, run.id);

    expect(completedRun.status).toBe("succeeded");
    expect(completedRun.output).toEqual({
      prepare: {
        echoed: "tool:ready",
        tool: "echo",
      },
    });
  });

  it("waits for approval, records the decision, and resumes only after approval", async () => {
    const persistence = createInMemoryRuntimePersistence();
    const runtime = new RuntimeEngine({
      approvalIdGenerator: () => "approval_1",
      idGenerator: createIdGenerator(),
      now: createClock(),
      persistence,
    });
    let gateExecutions = 0;
    const definition = {
      id: "workflow.approval.approved",
      name: "Approval workflow",
      steps: [
        {
          execute: (context: RuntimeStepContext) => {
            gateExecutions += 1;

            if (!context.checkpoint?.payload) {
              return awaitApproval({
                checkpointData: {
                  approved: true,
                },
                note: "Approve deployment",
                reviewer: {
                  id: "ops_1",
                },
              });
            }

            return completeStep({
              gateExecutions,
              resumed: true,
            });
          },
          key: "gate",
          name: "Gate",
        },
        {
          execute: () =>
            completeStep({
              status: "done",
            }),
          key: "finalize",
          name: "Finalize",
        },
      ],
      version: "0.1.0",
    };

    const run = await runtime.createRun(definition, {
      trigger: "approval-test",
    });
    const pausedRun = await runtime.executeRun(definition, run.id);
    const pendingApproval = await runtime.getPendingApproval(run.id);

    expect(pausedRun.status).toBe("paused");
    expect(pausedRun.pauseReason).toBe("awaiting_approval");
    expect(pendingApproval?.status).toBe("pending");
    expect(await runtime.getApprovals(run.id)).toHaveLength(1);

    await expect(runtime.resumeRun(definition, run.id)).rejects.toThrow(
      `Run "${run.id}" is waiting on approval "approval_1"`,
    );

    const approvalDecision = await runtime.decideApproval("approval_1", {
      actor: {
        id: "ops_1",
      },
      decision: "approved",
      note: "Looks good",
    });

    expect(approvalDecision.approval.status).toBe("approved");
    expect((await runtime.getPendingApproval(run.id)) ?? null).toBe(null);

    const resumedRun = await runtime.resumeRun(definition, run.id);
    const events = await runtime.getRunEvents(run.id);

    expect(resumedRun.status).toBe("succeeded");
    expect(resumedRun.output).toEqual({
      finalize: {
        status: "done",
      },
      gate: {
        gateExecutions: 2,
        resumed: true,
      },
    });
    expect(events.map((event) => event.name)).toContain("approval.requested");
    expect(events.map((event) => event.name)).toContain("approval.approved");
    expect(events.map((event) => event.name)).toContain("run.resumed");
  });

  it("cancels the run when an approval is rejected", async () => {
    const persistence = createInMemoryRuntimePersistence();
    const runtime = new RuntimeEngine({
      approvalIdGenerator: () => "approval_reject",
      idGenerator: createIdGenerator(),
      now: createClock(),
      persistence,
    });
    const definition = {
      id: "workflow.approval.rejected",
      name: "Rejected approval workflow",
      steps: [
        {
          execute: () =>
            awaitApproval({
              note: "Approve release",
            }),
          key: "gate",
          name: "Gate",
        },
      ],
      version: "0.1.0",
    };

    const run = await runtime.createRun(definition, {
      trigger: "approval-rejected",
    });

    await runtime.executeRun(definition, run.id);

    const decision = await runtime.decideApproval("approval_reject", {
      actor: {
        id: "ops_2",
      },
      decision: "rejected",
      note: "Not safe",
    });
    const events = await runtime.getRunEvents(run.id);

    expect(decision.run.status).toBe("cancelled");
    expect(decision.run.steps[0]?.status).toBe("cancelled");
    expect(events.map((event) => event.name)).toContain("approval.rejected");
    expect(events.map((event) => event.name)).toContain("run.cancelled");

    await expect(runtime.resumeRun(definition, run.id)).rejects.toThrow(
      `Run "${run.id}" is not paused and cannot be resumed.`,
    );
  });
});
