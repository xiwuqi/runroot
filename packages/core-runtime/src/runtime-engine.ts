import { randomUUID } from "node:crypto";

import type {
  ApprovalActor,
  ApprovalDecision,
  ApprovalDecisionInput,
  ApprovalDecisionValue,
  ApprovalRequest,
  ApprovalRequestInput,
} from "@runroot/approvals";
import {
  advanceRunCursor,
  calculateRetryDelayMs,
  createWorkflowRunSnapshot,
  createWorkflowStepSnapshot,
  type JsonValue,
  type RunStatus,
  resolveRetryPolicy,
  serializeError,
  transitionRunStatus,
  transitionStepStatus,
  type WorkflowCheckpoint,
  type WorkflowRun,
  type WorkflowStep,
} from "@runroot/domain";
import type { RuntimeEventInput } from "@runroot/events";
import type {
  RuntimePersistence,
  RuntimeTransitionCommit,
  RuntimeTransitionCommitResult,
} from "@runroot/persistence";
import { createUnavailableToolInvoker, type ToolInvoker } from "@runroot/tools";

import {
  type AwaitingApprovalStepResult,
  completeStep,
  type RuntimeStepContext,
  type StepExecutionResult,
  type WorkflowDefinition,
} from "./runtime-definition";

const APPROVAL_PAUSE_REASON = "awaiting_approval";

export class RuntimeExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeExecutionError";
  }
}

export interface CreateRunOptions {
  readonly metadata?: Readonly<Record<string, string>>;
  readonly runId?: string;
}

export interface DecideApprovalOptions {
  readonly actor?: ApprovalActor;
  readonly decision: ApprovalDecisionValue;
  readonly note?: string;
}

export interface ApprovalDecisionOutcome {
  readonly approval: ApprovalRequest;
  readonly decision: ApprovalDecision;
  readonly run: WorkflowRun;
}

export interface RuntimeEngineOptions {
  readonly approvalIdGenerator?: () => string;
  readonly idGenerator?: (prefix: "run" | "step") => string;
  readonly now?: () => string;
  readonly persistence: RuntimePersistence;
  readonly toolInvoker?: ToolInvoker;
}

export class RuntimeEngine {
  readonly #approvalIdGenerator: () => string;
  readonly #idGenerator: (prefix: "run" | "step") => string;
  readonly #now: () => string;
  readonly #persistence: RuntimePersistence;
  readonly #toolInvoker: ToolInvoker;

  constructor(options: RuntimeEngineOptions) {
    this.#approvalIdGenerator =
      options.approvalIdGenerator ?? (() => `approval_${randomUUID()}`);
    this.#idGenerator =
      options.idGenerator ??
      ((prefix: "run" | "step") => `${prefix}_${randomUUID()}`);
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#persistence = options.persistence;
    this.#toolInvoker = options.toolInvoker ?? createUnavailableToolInvoker();
  }

  async createRun(
    definition: WorkflowDefinition,
    input: JsonValue,
    options: CreateRunOptions = {},
  ): Promise<WorkflowRun> {
    const createdAt = this.#now();
    const runId = options.runId ?? this.#idGenerator("run");
    const workflowRetryPolicy = resolveRetryPolicy(definition.retryPolicy);
    const steps = definition.steps.map((stepDefinition, index) =>
      createWorkflowStepSnapshot({
        createdAt,
        id: this.#idGenerator("step"),
        index,
        key: stepDefinition.key,
        name: stepDefinition.name,
        retryPolicy: resolveRetryPolicy(
          stepDefinition.retryPolicy,
          workflowRetryPolicy,
        ),
        runId,
      }),
    );

    const run = createWorkflowRunSnapshot({
      createdAt,
      definitionId: definition.id,
      definitionName: definition.name,
      definitionVersion: definition.version,
      id: runId,
      input,
      ...(options.metadata ? { metadata: options.metadata } : {}),
      retryPolicy: workflowRetryPolicy,
      steps,
    });

    await this.#commitTransition({
      checkpoint: {
        attempt: 0,
        createdAt,
        nextStepIndex: 0,
        reason: "run_created",
        runId: run.id,
      },
      events: [
        {
          name: "run.created",
          occurredAt: createdAt,
          payload: {
            definitionId: definition.id,
            status: run.status,
          },
          runId: run.id,
        },
        ...(steps[0]
          ? [
              {
                name: "step.ready",
                occurredAt: createdAt,
                payload: {
                  attempt: 0,
                  status: steps[0].status,
                },
                runId: run.id,
                stepId: steps[0].id,
              } satisfies RuntimeEventInput<"step.ready">,
            ]
          : []),
      ],
      run,
    });

    return run;
  }

  async decideApproval(
    approvalId: string,
    options: DecideApprovalOptions,
  ): Promise<ApprovalDecisionOutcome> {
    const approval = await this.#persistence.approvals.get(approvalId);

    if (!approval) {
      throw new RuntimeExecutionError(
        `Approval "${approvalId}" was not found.`,
      );
    }

    const run = await this.#requireRun(approval.runId);

    if (run.status !== "paused") {
      throw new RuntimeExecutionError(
        `Run "${run.id}" is not paused and cannot accept approval decisions.`,
      );
    }

    const pendingApproval = await this.#persistence.approvals.getPendingByRunId(
      run.id,
    );

    if (!pendingApproval) {
      if (approval.status !== "pending") {
        throw new RuntimeExecutionError(
          `Approval "${approval.id}" is already in terminal status "${approval.status}".`,
        );
      }

      throw new RuntimeExecutionError(
        `Run "${run.id}" does not have a pending approval.`,
      );
    }

    if (pendingApproval.id !== approval.id) {
      throw new RuntimeExecutionError(
        `Approval "${approval.id}" is not the active pending approval for run "${run.id}".`,
      );
    }

    const decidedAt = this.#now();
    const approvalDecision = createApprovalDecisionInput(
      approvalId,
      decidedAt,
      options,
    );

    if (options.decision === "approved") {
      const result = await this.#commitTransition({
        approvalDecision,
        events: [
          createApprovalDecisionEvent(
            approvalDecision,
            run.id,
            approval.stepId,
          ),
        ],
        run,
      });

      if (!result.approval || !result.approvalDecision) {
        throw new RuntimeExecutionError(
          `Runtime approval transition for "${approval.id}" did not persist a decision result.`,
        );
      }

      return {
        approval: result.approval,
        decision: result.approvalDecision,
        run: result.run,
      };
    }

    const cancelledRun = cancelRunFromApproval(run, decidedAt);
    const cancelledStep = cancelledRun.steps[cancelledRun.currentStepIndex];
    const cancellationReason =
      approvalDecision.decision === "rejected"
        ? "approval rejected"
        : "approval cancelled";
    const result = await this.#commitTransition({
      approvalDecision,
      events: [
        createApprovalDecisionEvent(
          approvalDecision,
          cancelledRun.id,
          approval.stepId,
        ),
        ...(cancelledStep
          ? [
              {
                name: "step.cancelled",
                occurredAt: decidedAt,
                payload: {
                  attempt: cancelledStep.attempts,
                  reason: cancellationReason,
                  status: cancelledStep.status,
                },
                runId: cancelledRun.id,
                stepId: cancelledStep.id,
              } satisfies RuntimeEventInput<"step.cancelled">,
            ]
          : []),
        {
          name: "run.cancelled",
          occurredAt: decidedAt,
          payload: {
            approvalId: approval.id,
            reason: cancellationReason,
            status: cancelledRun.status,
          },
          runId: cancelledRun.id,
        } satisfies RuntimeEventInput<"run.cancelled">,
      ],
      run: cancelledRun,
    });

    if (!result.approval || !result.approvalDecision) {
      throw new RuntimeExecutionError(
        `Runtime approval transition for "${approval.id}" did not persist a decision result.`,
      );
    }

    return {
      approval: result.approval,
      decision: result.approvalDecision,
      run: result.run,
    };
  }

  async executeRun(
    definition: WorkflowDefinition,
    runId: string,
  ): Promise<WorkflowRun> {
    let run = await this.#requireRun(runId);

    this.#assertDefinitionCompatibility(definition, run);

    if (run.status === "paused") {
      throw new RuntimeExecutionError(
        `Run "${run.id}" is paused. Use resumeRun to continue execution.`,
      );
    }

    if (isTerminalRunStatus(run.status)) {
      return run;
    }

    run = await this.#prepareRunForExecution(run, "execute");

    if (run.steps.length === 0) {
      return this.#succeedRun(run);
    }

    return this.#runLoop(definition, run);
  }

  async getApproval(approvalId: string): Promise<ApprovalRequest | undefined> {
    return this.#persistence.approvals.get(approvalId);
  }

  async getApprovals(runId: string): Promise<ApprovalRequest[]> {
    return this.#persistence.approvals.listByRunId(runId);
  }

  async getCheckpoints(runId: string): Promise<WorkflowCheckpoint[]> {
    return this.#persistence.checkpoints.listByRunId(runId);
  }

  async getPendingApproval(
    runId: string,
  ): Promise<ApprovalRequest | undefined> {
    return this.#persistence.approvals.getPendingByRunId(runId);
  }

  async getRun(runId: string): Promise<WorkflowRun | undefined> {
    return this.#persistence.runs.get(runId);
  }

  async getRunEvents(runId: string) {
    return this.#persistence.events.listByRunId(runId);
  }

  async pauseRun(runId: string, reason: string): Promise<WorkflowRun> {
    const run = await this.#requireRun(runId);

    if (isTerminalRunStatus(run.status) || run.status === "paused") {
      return run;
    }

    if (run.status === "pending") {
      throw new RuntimeExecutionError(
        `Run "${run.id}" has not started. pauseRun is only supported after the run enters queued or running status.`,
      );
    }

    const pausedAt = this.#now();
    const pausedRun = transitionRunStatus(run, "paused", pausedAt, {
      pauseReason: reason,
    });
    const pausedStepId = pausedRun.steps[pausedRun.currentStepIndex]?.id;

    await this.#commitTransition({
      checkpoint: {
        attempt: pausedRun.steps[pausedRun.currentStepIndex]?.attempts ?? 0,
        createdAt: pausedAt,
        nextStepIndex: pausedRun.currentStepIndex,
        reason: "run_paused",
        runId: pausedRun.id,
        ...(pausedStepId ? { stepId: pausedStepId } : {}),
      },
      events: [
        {
          name: "run.paused",
          occurredAt: pausedAt,
          payload: {
            reason,
            status: pausedRun.status,
          },
          runId: pausedRun.id,
        },
      ],
      run: pausedRun,
    });

    return pausedRun;
  }

  async resumeRun(
    definition: WorkflowDefinition,
    runId: string,
  ): Promise<WorkflowRun> {
    const run = await this.#requireRun(runId);

    this.#assertDefinitionCompatibility(definition, run);

    if (run.status !== "paused") {
      throw new RuntimeExecutionError(
        `Run "${run.id}" is not paused and cannot be resumed.`,
      );
    }

    const pendingApproval = await this.#persistence.approvals.getPendingByRunId(
      run.id,
    );

    if (pendingApproval) {
      throw new RuntimeExecutionError(
        `Run "${run.id}" is waiting on approval "${pendingApproval.id}" and cannot resume until the decision is recorded.`,
      );
    }

    const resumedRun = await this.#prepareRunForExecution(run, "resume");

    if (resumedRun.steps.length === 0) {
      return this.#succeedRun(resumedRun);
    }

    return this.#runLoop(definition, resumedRun);
  }

  #assertDefinitionCompatibility(
    definition: WorkflowDefinition,
    run: WorkflowRun,
  ): void {
    if (run.definitionId !== definition.id) {
      throw new RuntimeExecutionError(
        `Workflow definition mismatch for run "${run.id}". Expected "${run.definitionId}", received "${definition.id}".`,
      );
    }

    if (run.steps.length !== definition.steps.length) {
      throw new RuntimeExecutionError(
        `Workflow step count mismatch for run "${run.id}". Expected ${run.steps.length}, received ${definition.steps.length}.`,
      );
    }

    for (const [index, step] of run.steps.entries()) {
      const definitionStep = definition.steps[index];

      if (!definitionStep || definitionStep.key !== step.key) {
        throw new RuntimeExecutionError(
          `Workflow step mismatch at index ${index} for run "${run.id}".`,
        );
      }
    }
  }

  async #commitTransition(
    transition: RuntimeTransitionCommit,
  ): Promise<RuntimeTransitionCommitResult> {
    return this.#persistence.commitTransition(transition);
  }

  async #prepareRunForExecution(
    run: WorkflowRun,
    mode: "execute" | "resume",
  ): Promise<WorkflowRun> {
    let nextRun = run;

    if (mode === "execute" && nextRun.status === "pending") {
      const queuedAt = this.#now();
      const queuedRun = transitionRunStatus(nextRun, "queued", queuedAt);
      const commitResult = await this.#commitTransition({
        events: [
          {
            name: "run.queued",
            occurredAt: queuedAt,
            payload: {
              fromStatus: nextRun.status,
              toStatus: queuedRun.status,
            },
            runId: queuedRun.id,
          },
        ],
        run: queuedRun,
      });

      nextRun = commitResult.run;
    }

    if (mode === "resume") {
      const latestCheckpoint =
        await this.#persistence.checkpoints.getLatestByRunId(nextRun.id);
      const resumedAt = this.#now();
      const queuedRun = transitionRunStatus(nextRun, "queued", resumedAt);
      const commitResult = await this.#commitTransition({
        events: [
          {
            name: "run.resumed",
            occurredAt: resumedAt,
            payload: {
              ...(latestCheckpoint
                ? { checkpointId: latestCheckpoint.id }
                : {}),
              fromStatus: nextRun.status,
              toStatus: queuedRun.status,
            },
            runId: queuedRun.id,
          },
        ],
        run: queuedRun,
      });

      nextRun = commitResult.run;
    }

    if (nextRun.status === "queued") {
      const startedAt = this.#now();
      const runningRun = transitionRunStatus(nextRun, "running", startedAt);
      const commitResult = await this.#commitTransition({
        events: [
          {
            name: "run.started",
            occurredAt: startedAt,
            payload: {
              fromStatus: nextRun.status,
              toStatus: runningRun.status,
            },
            runId: runningRun.id,
          },
        ],
        run: runningRun,
      });

      nextRun = commitResult.run;
    }

    return nextRun;
  }

  async #requireRun(runId: string): Promise<WorkflowRun> {
    const run = await this.#persistence.runs.get(runId);

    if (!run) {
      throw new RuntimeExecutionError(`Run "${runId}" was not found.`);
    }

    return run;
  }

  async #runLoop(
    definition: WorkflowDefinition,
    initialRun: WorkflowRun,
  ): Promise<WorkflowRun> {
    let run = initialRun;
    let latestCheckpoint = await this.#persistence.checkpoints.getLatestByRunId(
      run.id,
    );

    while (run.currentStepIndex < run.steps.length) {
      const stepDefinition = definition.steps[run.currentStepIndex];
      const step = run.steps[run.currentStepIndex];

      if (!stepDefinition || !step) {
        throw new RuntimeExecutionError(
          `Missing step definition or snapshot at index ${run.currentStepIndex} for run "${run.id}".`,
        );
      }

      let readyStep = step;

      if (
        step.status === "idle" ||
        step.status === "paused" ||
        step.status === "retry_scheduled"
      ) {
        const readyAt = this.#now();
        readyStep = transitionStepStatus(step, "ready", readyAt);
        const commitResult = await this.#commitTransition({
          events: [
            {
              name: "step.ready",
              occurredAt: readyAt,
              payload: {
                attempt: readyStep.attempts,
                status: readyStep.status,
              },
              runId: run.id,
              stepId: readyStep.id,
            },
          ],
          run: replaceStepInRun(run, readyStep, readyAt),
        });

        run = commitResult.run;
      }

      const startedAt = this.#now();
      const runningStep = transitionStepStatus(readyStep, "running", startedAt);
      const runningRun = replaceStepInRun(run, runningStep, startedAt);
      const runningResult = await this.#commitTransition({
        events: [
          {
            name: "step.started",
            occurredAt: startedAt,
            payload: {
              attempt: runningStep.attempts,
              status: runningStep.status,
            },
            runId: runningRun.id,
            stepId: runningStep.id,
          },
        ],
        run: runningRun,
      });

      run = runningResult.run;

      const checkpointForStep =
        latestCheckpoint?.stepId === runningStep.id
          ? latestCheckpoint
          : undefined;

      latestCheckpoint = undefined;

      try {
        const executionResult = normalizeExecutionResult(
          await stepDefinition.execute(
            createStepContext(
              run,
              runningStep,
              this.#toolInvoker,
              checkpointForStep,
            ),
          ),
        );

        if (executionResult.kind === "awaiting_approval") {
          run = await this.#awaitApprovalFromStep(
            run,
            runningStep,
            executionResult,
          );

          return run;
        }

        if (executionResult.kind === "paused") {
          run = await this.#pauseFromStep(run, runningStep, executionResult);

          return run;
        }

        run = await this.#completeStep(
          run,
          runningStep,
          executionResult.output,
        );

        if (run.currentStepIndex >= run.steps.length) {
          return this.#succeedRun(run);
        }
      } catch (error) {
        run = await this.#handleStepFailure(run, runningStep, error);

        if (run.status === "failed") {
          return run;
        }
      }
    }

    return run.status === "succeeded" ? run : this.#succeedRun(run);
  }

  async #awaitApprovalFromStep(
    run: WorkflowRun,
    step: WorkflowStep,
    result: AwaitingApprovalStepResult,
  ): Promise<WorkflowRun> {
    const requestedAt = this.#now();
    const pausedStep = transitionStepStatus(step, "paused", requestedAt);
    const pausedRun = transitionRunStatus(
      replaceStepInRun(run, pausedStep, requestedAt),
      "paused",
      requestedAt,
      {
        pauseReason: APPROVAL_PAUSE_REASON,
      },
    );
    const approvalRequest = createApprovalRequestInput(
      pausedRun,
      pausedStep,
      requestedAt,
      result,
      this.#approvalIdGenerator,
    );

    await this.#commitTransition({
      approvalRequest,
      checkpoint: {
        attempt: pausedStep.attempts,
        createdAt: requestedAt,
        nextStepIndex: pausedRun.currentStepIndex,
        ...(result.checkpointData === undefined
          ? {}
          : { payload: result.checkpointData }),
        reason: "step_paused",
        runId: pausedRun.id,
        stepId: pausedStep.id,
      },
      events: [
        {
          name: "step.paused",
          occurredAt: requestedAt,
          payload: {
            attempt: pausedStep.attempts,
            reason: APPROVAL_PAUSE_REASON,
            status: pausedStep.status,
          },
          runId: pausedRun.id,
          stepId: pausedStep.id,
        },
        {
          name: "run.paused",
          occurredAt: requestedAt,
          payload: {
            reason: APPROVAL_PAUSE_REASON,
            status: pausedRun.status,
          },
          runId: pausedRun.id,
        },
        {
          name: "approval.requested",
          occurredAt: requestedAt,
          payload: {
            approvalId: approvalRequest.id,
            ...(approvalRequest.reviewer
              ? { reviewerId: approvalRequest.reviewer.id }
              : {}),
            status: "pending",
          },
          runId: pausedRun.id,
          stepId: pausedStep.id,
        } satisfies RuntimeEventInput<"approval.requested">,
      ],
      run: pausedRun,
    });

    return pausedRun;
  }

  async #completeStep(
    run: WorkflowRun,
    step: WorkflowStep,
    output?: JsonValue,
  ): Promise<WorkflowRun> {
    const completedAt = this.#now();
    const completedStep = transitionStepStatus(step, "completed", completedAt, {
      ...(output === undefined ? {} : { output }),
    });
    const nextStepIndex = run.currentStepIndex + 1;
    const completedRun = advanceRunCursor(
      replaceStepInRun(run, completedStep, completedAt),
      nextStepIndex,
      completedAt,
    );

    await this.#commitTransition({
      checkpoint: {
        attempt: completedStep.attempts,
        createdAt: completedAt,
        nextStepIndex,
        reason: "step_completed",
        runId: completedRun.id,
        stepId: completedStep.id,
      },
      events: [
        {
          name: "step.completed",
          occurredAt: completedAt,
          payload: {
            attempt: completedStep.attempts,
            status: completedStep.status,
          },
          runId: completedRun.id,
          stepId: completedStep.id,
        },
      ],
      run: completedRun,
    });

    if (!completedRun.steps[nextStepIndex]) {
      return completedRun;
    }

    const nextStep = transitionStepStatus(
      completedRun.steps[nextStepIndex],
      "ready",
      completedAt,
    );
    const readyResult = await this.#commitTransition({
      events: [
        {
          name: "step.ready",
          occurredAt: completedAt,
          payload: {
            attempt: nextStep.attempts,
            status: nextStep.status,
          },
          runId: completedRun.id,
          stepId: nextStep.id,
        },
      ],
      run: replaceStepInRun(completedRun, nextStep, completedAt),
    });

    return readyResult.run;
  }

  async #handleStepFailure(
    run: WorkflowRun,
    step: WorkflowStep,
    error: unknown,
  ): Promise<WorkflowRun> {
    const failedAt = this.#now();
    const retryable = step.attempts < step.maxAttempts;
    const failure = serializeError(error, retryable);
    const failedStepStatus = retryable ? "retry_scheduled" : "failed";
    const failedStep = transitionStepStatus(step, failedStepStatus, failedAt, {
      error: failure,
    });
    const failedRun = replaceStepInRun(run, failedStep, failedAt);
    const delayMs = retryable
      ? calculateRetryDelayMs(failedStep.retryPolicy, failedStep.attempts)
      : 0;

    if (retryable) {
      await this.#commitTransition({
        checkpoint: {
          attempt: failedStep.attempts,
          createdAt: failedAt,
          nextStepIndex: failedRun.currentStepIndex,
          reason: "step_retry_scheduled",
          runId: failedRun.id,
          stepId: failedStep.id,
        },
        events: [
          {
            name: "step.failed",
            occurredAt: failedAt,
            payload: {
              attempt: failedStep.attempts,
              error: failure,
              status: failedStep.status,
            },
            runId: failedRun.id,
            stepId: failedStep.id,
          },
          {
            name: "step.retry_scheduled",
            occurredAt: failedAt,
            payload: {
              attempt: failedStep.attempts,
              delayMs,
              nextAttempt: failedStep.attempts + 1,
              status: failedStep.status,
            },
            runId: failedRun.id,
            stepId: failedStep.id,
          } satisfies RuntimeEventInput<"step.retry_scheduled">,
        ],
        run: failedRun,
      });

      return failedRun;
    }

    const terminalRun = transitionRunStatus(failedRun, "failed", failedAt, {
      failure,
    });

    await this.#commitTransition({
      checkpoint: {
        attempt: failedStep.attempts,
        createdAt: failedAt,
        nextStepIndex: failedRun.currentStepIndex,
        reason: "run_failed",
        runId: failedRun.id,
        stepId: failedStep.id,
      },
      events: [
        {
          name: "step.failed",
          occurredAt: failedAt,
          payload: {
            attempt: failedStep.attempts,
            error: failure,
            status: failedStep.status,
          },
          runId: failedRun.id,
          stepId: failedStep.id,
        },
        {
          name: "run.failed",
          occurredAt: failedAt,
          payload: {
            error: failure,
            status: terminalRun.status,
          },
          runId: terminalRun.id,
        },
      ],
      run: terminalRun,
    });

    return terminalRun;
  }

  async #pauseFromStep(
    run: WorkflowRun,
    step: WorkflowStep,
    result: Extract<StepExecutionResult, { kind: "paused" }>,
  ): Promise<WorkflowRun> {
    const pausedAt = this.#now();
    const pausedStep = transitionStepStatus(step, "paused", pausedAt);
    const pausedRun = transitionRunStatus(
      replaceStepInRun(run, pausedStep, pausedAt),
      "paused",
      pausedAt,
      {
        pauseReason: result.reason,
      },
    );

    await this.#commitTransition({
      checkpoint: {
        attempt: pausedStep.attempts,
        createdAt: pausedAt,
        nextStepIndex: pausedRun.currentStepIndex,
        ...(result.checkpointData === undefined
          ? {}
          : { payload: result.checkpointData }),
        reason: "step_paused",
        runId: pausedRun.id,
        stepId: pausedStep.id,
      },
      events: [
        {
          name: "step.paused",
          occurredAt: pausedAt,
          payload: {
            attempt: pausedStep.attempts,
            reason: result.reason,
            status: pausedStep.status,
          },
          runId: pausedRun.id,
          stepId: pausedStep.id,
        },
        {
          name: "run.paused",
          occurredAt: pausedAt,
          payload: {
            reason: result.reason,
            status: pausedRun.status,
          },
          runId: pausedRun.id,
        },
      ],
      run: pausedRun,
    });

    return pausedRun;
  }

  async #succeedRun(run: WorkflowRun): Promise<WorkflowRun> {
    if (run.status === "succeeded") {
      return run;
    }

    const succeededAt = this.#now();
    const succeededRun = transitionRunStatus(run, "succeeded", succeededAt);
    const succeededStepId = succeededRun.steps.at(-1)?.id;

    await this.#commitTransition({
      checkpoint: {
        attempt: succeededRun.steps.at(-1)?.attempts ?? 0,
        createdAt: succeededAt,
        nextStepIndex: succeededRun.currentStepIndex,
        reason: "run_succeeded",
        runId: succeededRun.id,
        ...(succeededStepId ? { stepId: succeededStepId } : {}),
      },
      events: [
        {
          name: "run.succeeded",
          occurredAt: succeededAt,
          payload: {
            completedStepCount: succeededRun.steps.filter(
              (step) => step.status === "completed",
            ).length,
            status: succeededRun.status,
          },
          runId: succeededRun.id,
        },
      ],
      run: succeededRun,
    });

    return succeededRun;
  }
}

function cancelRunFromApproval(
  run: WorkflowRun,
  cancelledAt: string,
): WorkflowRun {
  const currentStep = run.steps[run.currentStepIndex];

  if (!currentStep) {
    return transitionRunStatus(run, "cancelled", cancelledAt);
  }

  const cancelledStep = transitionStepStatus(
    currentStep,
    "cancelled",
    cancelledAt,
  );

  return transitionRunStatus(
    replaceStepInRun(run, cancelledStep, cancelledAt),
    "cancelled",
    cancelledAt,
  );
}

function createApprovalDecisionEvent(
  decision: ApprovalDecisionInput,
  runId: string,
  stepId?: string,
): RuntimeEventInput<
  "approval.approved" | "approval.cancelled" | "approval.rejected"
> {
  const eventName = approvalDecisionToEventName(decision.decision);

  return {
    name: eventName,
    occurredAt: decision.decidedAt,
    payload: {
      approvalId: decision.approvalId,
      ...(decision.actor ? { actorId: decision.actor.id } : {}),
      decision: decision.decision,
      status: decision.decision,
    },
    runId,
    ...(stepId ? { stepId } : {}),
  };
}

function createApprovalDecisionInput(
  approvalId: string,
  decidedAt: string,
  options: DecideApprovalOptions,
): ApprovalDecisionInput {
  return {
    approvalId,
    decidedAt,
    decision: options.decision,
    ...(options.actor ? { actor: options.actor } : {}),
    ...(options.note === undefined ? {} : { note: options.note }),
  };
}

function createApprovalRequestInput(
  run: WorkflowRun,
  step: WorkflowStep,
  requestedAt: string,
  result: AwaitingApprovalStepResult,
  generateApprovalId: () => string,
): ApprovalRequestInput {
  return {
    id: generateApprovalId(),
    ...(result.note === undefined ? {} : { note: result.note }),
    requestedAt,
    ...(result.requestedBy ? { requestedBy: result.requestedBy } : {}),
    ...(result.reviewer ? { reviewer: result.reviewer } : {}),
    runId: run.id,
    stepId: step.id,
  };
}

function createStepContext(
  run: WorkflowRun,
  step: WorkflowStep,
  tools: ToolInvoker,
  checkpoint?: WorkflowCheckpoint,
): RuntimeStepContext {
  return {
    attempt: step.attempts,
    ...(checkpoint ? { checkpoint } : {}),
    input: run.input,
    run,
    step,
    tools,
  };
}

function approvalDecisionToEventName(
  decision: ApprovalDecisionValue,
): "approval.approved" | "approval.cancelled" | "approval.rejected" {
  switch (decision) {
    case "approved":
      return "approval.approved";
    case "cancelled":
      return "approval.cancelled";
    case "rejected":
      return "approval.rejected";
  }
}

function isTerminalRunStatus(status: RunStatus): boolean {
  return ["cancelled", "failed", "succeeded"].includes(status);
}

function normalizeExecutionResult(
  result: StepExecutionResult | undefined,
): StepExecutionResult {
  if (!result) {
    return completeStep();
  }

  return result;
}

function replaceStepInRun(
  run: WorkflowRun,
  nextStep: WorkflowStep,
  updatedAt: string,
): WorkflowRun {
  return {
    ...run,
    steps: run.steps.map((step) => (step.id === nextStep.id ? nextStep : step)),
    updatedAt,
  };
}
