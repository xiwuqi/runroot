import { randomUUID } from "node:crypto";

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
import type { CheckpointWrite, RuntimePersistence } from "@runroot/persistence";
import { createUnavailableToolInvoker, type ToolInvoker } from "@runroot/tools";

import {
  completeStep,
  type RuntimeStepContext,
  type StepExecutionResult,
  type WorkflowDefinition,
} from "./runtime-definition";

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

export interface RuntimeEngineOptions {
  readonly idGenerator?: (prefix: "run" | "step") => string;
  readonly now?: () => string;
  readonly persistence: RuntimePersistence;
  readonly toolInvoker?: ToolInvoker;
}

export class RuntimeEngine {
  readonly #idGenerator: (prefix: "run" | "step") => string;
  readonly #now: () => string;
  readonly #persistence: RuntimePersistence;
  readonly #toolInvoker: ToolInvoker;

  constructor(options: RuntimeEngineOptions) {
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

    await this.#commitTransition(
      run,
      [
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
      {
        attempt: 0,
        createdAt,
        nextStepIndex: 0,
        reason: "run_created",
        runId: run.id,
      },
    );

    return run;
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

  async getCheckpoints(runId: string): Promise<WorkflowCheckpoint[]> {
    return this.#persistence.checkpoints.listByRunId(runId);
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

    await this.#commitTransition(
      pausedRun,
      [
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
      {
        attempt: pausedRun.steps[pausedRun.currentStepIndex]?.attempts ?? 0,
        createdAt: pausedAt,
        nextStepIndex: pausedRun.currentStepIndex,
        reason: "run_paused",
        runId: pausedRun.id,
        ...(pausedStepId ? { stepId: pausedStepId } : {}),
      },
    );

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
    run: WorkflowRun,
    events: readonly RuntimeEventInput[],
    checkpoint?: CheckpointWrite,
  ): Promise<WorkflowRun> {
    await this.#persistence.commitTransition({
      ...(checkpoint ? { checkpoint } : {}),
      events,
      run,
    });

    return run;
  }

  async #prepareRunForExecution(
    run: WorkflowRun,
    mode: "execute" | "resume",
  ): Promise<WorkflowRun> {
    let nextRun = run;

    if (mode === "execute" && nextRun.status === "pending") {
      const queuedAt = this.#now();
      const queuedRun = transitionRunStatus(nextRun, "queued", queuedAt);

      nextRun = await this.#commitTransition(queuedRun, [
        {
          name: "run.queued",
          occurredAt: queuedAt,
          payload: {
            fromStatus: nextRun.status,
            toStatus: queuedRun.status,
          },
          runId: queuedRun.id,
        },
      ]);
    }

    if (mode === "resume") {
      const latestCheckpoint =
        await this.#persistence.checkpoints.getLatestByRunId(nextRun.id);
      const resumedAt = this.#now();
      const queuedRun = transitionRunStatus(nextRun, "queued", resumedAt);

      nextRun = await this.#commitTransition(queuedRun, [
        {
          name: "run.resumed",
          occurredAt: resumedAt,
          payload: {
            ...(latestCheckpoint ? { checkpointId: latestCheckpoint.id } : {}),
            fromStatus: nextRun.status,
            toStatus: queuedRun.status,
          },
          runId: queuedRun.id,
        },
      ]);
    }

    if (nextRun.status === "queued") {
      const startedAt = this.#now();
      const runningRun = transitionRunStatus(nextRun, "running", startedAt);

      nextRun = await this.#commitTransition(runningRun, [
        {
          name: "run.started",
          occurredAt: startedAt,
          payload: {
            fromStatus: nextRun.status,
            toStatus: runningRun.status,
          },
          runId: runningRun.id,
        },
      ]);
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
        run = await this.#commitTransition(
          replaceStepInRun(run, readyStep, readyAt),
          [
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
        );
      }

      const startedAt = this.#now();
      const runningStep = transitionStepStatus(readyStep, "running", startedAt);
      const runningRun = replaceStepInRun(run, runningStep, startedAt);

      run = await this.#commitTransition(runningRun, [
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
      ]);

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

    await this.#commitTransition(
      completedRun,
      [
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
      {
        attempt: completedStep.attempts,
        createdAt: completedAt,
        nextStepIndex,
        reason: "step_completed",
        runId: completedRun.id,
        stepId: completedStep.id,
      },
    );

    if (!completedRun.steps[nextStepIndex]) {
      return completedRun;
    }

    const nextStep = transitionStepStatus(
      completedRun.steps[nextStepIndex],
      "ready",
      completedAt,
    );

    return this.#commitTransition(
      replaceStepInRun(completedRun, nextStep, completedAt),
      [
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
    );
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
      await this.#commitTransition(
        failedRun,
        [
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
        {
          attempt: failedStep.attempts,
          createdAt: failedAt,
          nextStepIndex: failedRun.currentStepIndex,
          reason: "step_retry_scheduled",
          runId: failedRun.id,
          stepId: failedStep.id,
        },
      );

      return failedRun;
    }

    const terminalRun = transitionRunStatus(failedRun, "failed", failedAt, {
      failure,
    });

    await this.#commitTransition(
      terminalRun,
      [
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
      {
        attempt: failedStep.attempts,
        createdAt: failedAt,
        nextStepIndex: failedRun.currentStepIndex,
        reason: "run_failed",
        runId: failedRun.id,
        stepId: failedStep.id,
      },
    );

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

    await this.#commitTransition(
      pausedRun,
      [
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
      {
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
    );

    return pausedRun;
  }

  async #succeedRun(run: WorkflowRun): Promise<WorkflowRun> {
    if (run.status === "succeeded") {
      return run;
    }

    const succeededAt = this.#now();
    const succeededRun = transitionRunStatus(run, "succeeded", succeededAt);

    const succeededStepId = succeededRun.steps.at(-1)?.id;

    await this.#commitTransition(
      succeededRun,
      [
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
      {
        attempt: succeededRun.steps.at(-1)?.attempts ?? 0,
        createdAt: succeededAt,
        nextStepIndex: succeededRun.currentStepIndex,
        reason: "run_succeeded",
        runId: succeededRun.id,
        ...(succeededStepId ? { stepId: succeededStepId } : {}),
      },
    );

    return succeededRun;
  }
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
