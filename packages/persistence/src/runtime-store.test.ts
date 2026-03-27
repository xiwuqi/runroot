import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createWorkflowRunSnapshot,
  createWorkflowStepSnapshot,
  resolveRetryPolicy,
} from "@runroot/domain";
import { describe, expect, it } from "vitest";

import {
  createFileRuntimePersistence,
  createInMemoryRuntimePersistence,
} from "./runtime-store";

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

  it("stores approval requests and decisions through the atomic transition boundary", async () => {
    const run = createRun("run_approval");
    const stepId = run.steps[0]?.id;
    const persistence = createInMemoryRuntimePersistence({
      idGenerator: (prefix) => `${prefix}_fixed`,
    });

    await persistence.commitTransition({
      approvalRequest: {
        id: "approval_1",
        note: "Approve release",
        requestedAt: "2026-03-27T00:00:05.000Z",
        reviewer: {
          id: "ops_1",
        },
        runId: run.id,
        ...(stepId ? { stepId } : {}),
      },
      events: [
        {
          name: "approval.requested",
          occurredAt: "2026-03-27T00:00:05.000Z",
          payload: {
            approvalId: "approval_1",
            reviewerId: "ops_1",
            status: "pending",
          },
          runId: run.id,
          ...(stepId ? { stepId } : {}),
        },
      ],
      run,
    });

    const decisionResult = await persistence.commitTransition({
      approvalDecision: {
        actor: {
          id: "ops_1",
        },
        approvalId: "approval_1",
        decidedAt: "2026-03-27T00:01:00.000Z",
        decision: "approved",
      },
      events: [
        {
          name: "approval.approved",
          occurredAt: "2026-03-27T00:01:00.000Z",
          payload: {
            actorId: "ops_1",
            approvalId: "approval_1",
            decision: "approved",
            status: "approved",
          },
          runId: run.id,
          ...(stepId ? { stepId } : {}),
        },
      ],
      run,
    });

    expect(
      (await persistence.approvals.getPendingByRunId(run.id)) ?? null,
    ).toBe(null);
    expect(await persistence.approvals.listByRunId(run.id)).toHaveLength(1);
    expect(decisionResult.approval?.status).toBe("approved");
    expect(
      (await persistence.events.listByRunId(run.id)).map((event) => event.name),
    ).toEqual(["approval.requested", "approval.approved"]);
  });

  it("does not persist partial state when approval decisions reference an unknown approval", async () => {
    const run = createRun("run_missing_approval");
    const persistence = createInMemoryRuntimePersistence();

    await expect(
      persistence.commitTransition({
        approvalDecision: {
          approvalId: "approval_missing",
          decidedAt: "2026-03-27T00:01:00.000Z",
          decision: "rejected",
        },
        events: [
          {
            name: "approval.rejected",
            occurredAt: "2026-03-27T00:01:00.000Z",
            payload: {
              approvalId: "approval_missing",
              decision: "rejected",
              status: "rejected",
            },
            runId: run.id,
          },
        ],
        run,
      }),
    ).rejects.toThrow('Approval "approval_missing" was not found.');

    expect(await persistence.runs.get(run.id)).toBeUndefined();
    expect(await persistence.events.listByRunId(run.id)).toEqual([]);
    expect(await persistence.approvals.listByRunId(run.id)).toEqual([]);
  });

  it("persists runtime state to a JSON workspace file", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-persistence-"));
    const filePath = join(workspaceRoot, "workspace.json");
    const run = createRun("run_file");
    const persistence = createFileRuntimePersistence({
      filePath,
      idGenerator: (prefix) => `${prefix}_fixed`,
    });

    await persistence.commitTransition({
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
    });

    const reloadedPersistence = createFileRuntimePersistence({
      filePath,
      idGenerator: (prefix) => `${prefix}_fixed`,
    });

    expect(await reloadedPersistence.runs.get(run.id)).toEqual(run);
    expect(
      (await reloadedPersistence.events.listByRunId(run.id)).map(
        (event) => event.name,
      ),
    ).toEqual(["run.created", "checkpoint.saved"]);
  });
});
