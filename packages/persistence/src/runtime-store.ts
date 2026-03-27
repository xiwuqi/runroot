import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type {
  ApprovalDecision,
  ApprovalDecisionInput,
  ApprovalId,
  ApprovalRequest,
  ApprovalRequestInput,
} from "@runroot/approvals";
import {
  ApprovalNotFoundError,
  createApprovalRequest,
  decideApproval,
} from "@runroot/approvals";
import type {
  CheckpointId,
  CheckpointReason,
  JsonValue,
  RunId,
  StepId,
  WorkflowCheckpoint,
  WorkflowRun,
} from "@runroot/domain";
import type { RuntimeEvent, RuntimeEventInput } from "@runroot/events";

export interface ApprovalRepository {
  get(approvalId: ApprovalId): Promise<ApprovalRequest | undefined>;
  getPendingByRunId(runId: RunId): Promise<ApprovalRequest | undefined>;
  listByRunId(runId: RunId): Promise<ApprovalRequest[]>;
}

export interface CheckpointWrite {
  readonly attempt: number;
  readonly createdAt: string;
  readonly id?: CheckpointId;
  readonly nextStepIndex: number;
  readonly payload?: JsonValue;
  readonly reason: CheckpointReason;
  readonly runId: RunId;
  readonly stepId?: StepId;
}

export interface CheckpointRepository {
  getLatestByRunId(runId: RunId): Promise<WorkflowCheckpoint | undefined>;
  listByRunId(runId: RunId): Promise<WorkflowCheckpoint[]>;
  save(checkpoint: CheckpointWrite): Promise<WorkflowCheckpoint>;
}

export interface EventRepository {
  append(events: readonly RuntimeEventInput[]): Promise<RuntimeEvent[]>;
  listByRunId(runId: RunId): Promise<RuntimeEvent[]>;
}

export interface RunRepository {
  get(runId: RunId): Promise<WorkflowRun | undefined>;
  list(): Promise<WorkflowRun[]>;
  put(run: WorkflowRun): Promise<WorkflowRun>;
}

export interface RuntimePersistence {
  readonly approvals: ApprovalRepository;
  readonly checkpoints: CheckpointRepository;
  commitTransition(
    transition: RuntimeTransitionCommit,
  ): Promise<RuntimeTransitionCommitResult>;
  readonly events: EventRepository;
  readonly runs: RunRepository;
}

export interface InMemoryRuntimePersistenceOptions {
  readonly idGenerator?: (prefix: "checkpoint" | "event") => string;
  readonly snapshot?: RuntimePersistenceSnapshot;
}

export interface FileRuntimePersistenceOptions {
  readonly filePath: string;
  readonly idGenerator?: (prefix: "checkpoint" | "event") => string;
  readonly lockRetryDelayMs?: number;
  readonly lockTimeoutMs?: number;
}

export interface RuntimeTransitionCommit {
  readonly approvalDecision?: ApprovalDecisionInput;
  readonly approvalRequest?: ApprovalRequestInput;
  readonly checkpoint?: CheckpointWrite;
  readonly events?: readonly RuntimeEventInput[];
  readonly run: WorkflowRun;
}

export interface RuntimeTransitionCommitResult {
  readonly approval?: ApprovalRequest;
  readonly approvalDecision?: ApprovalDecision;
  readonly checkpoint?: WorkflowCheckpoint;
  readonly events: readonly RuntimeEvent[];
  readonly run: WorkflowRun;
}

export interface RuntimePersistenceSnapshot {
  readonly approvals: readonly ApprovalRequest[];
  readonly checkpoints: readonly WorkflowCheckpoint[];
  readonly events: readonly RuntimeEvent[];
  readonly runs: readonly WorkflowRun[];
}

export function createInMemoryRuntimePersistence(
  options: InMemoryRuntimePersistenceOptions = {},
): RuntimePersistence {
  const approvalsById = new Map<ApprovalId, ApprovalRequest>();
  const approvalsByRunId = new Map<RunId, ApprovalId[]>();
  const runs = new Map<RunId, WorkflowRun>();
  const events = new Map<RunId, RuntimeEvent[]>();
  const checkpoints = new Map<RunId, WorkflowCheckpoint[]>();

  const generateId =
    options.idGenerator ??
    ((prefix: "checkpoint" | "event") => `${prefix}_${randomUUID()}`);

  seedInMemoryState(
    {
      approvalsById,
      approvalsByRunId,
      checkpoints,
      events,
      runs,
    },
    options.snapshot,
  );

  return {
    async commitTransition(transition) {
      const existingApproval = assertTransitionRunIds(
        transition,
        approvalsById,
      );

      const nextEvents = transition.events ?? [];
      const existingRunEvents = events.get(transition.run.id) ?? [];
      const existingCheckpoints = checkpoints.get(transition.run.id) ?? [];
      const approvalResult = transition.approvalDecision
        ? decideExistingApproval(existingApproval, transition.approvalDecision)
        : undefined;
      const persistedApproval =
        transition.approvalRequest !== undefined
          ? createApprovalRequest(transition.approvalRequest)
          : approvalResult?.approval;
      const persistedApprovalDecision = approvalResult?.decision;

      const persistedCheckpoint = transition.checkpoint
        ? createPersistedCheckpoint(
            transition.checkpoint,
            existingCheckpoints.length + 1,
            generateId,
          )
        : undefined;

      const persistedEvents = nextEvents.map((event, index) =>
        createPersistedEvent(
          event,
          existingRunEvents.length + index + 1,
          generateId,
        ),
      );

      const checkpointEvents = persistedCheckpoint
        ? [
            createPersistedEvent(
              createCheckpointSavedEvent(persistedCheckpoint),
              existingRunEvents.length + persistedEvents.length + 1,
              generateId,
            ),
          ]
        : [];

      runs.set(transition.run.id, clone(transition.run));
      events.set(transition.run.id, [
        ...existingRunEvents,
        ...persistedEvents.map((event) => clone(event)),
        ...checkpointEvents.map((event) => clone(event)),
      ]);

      if (persistedCheckpoint) {
        checkpoints.set(transition.run.id, [
          ...existingCheckpoints,
          clone(persistedCheckpoint),
        ]);
      }

      if (transition.approvalRequest && persistedApproval) {
        approvalsById.set(persistedApproval.id, clone(persistedApproval));
        approvalsByRunId.set(transition.run.id, [
          ...(approvalsByRunId.get(transition.run.id) ?? []),
          persistedApproval.id,
        ]);
      }

      if (transition.approvalDecision && persistedApproval) {
        approvalsById.set(persistedApproval.id, clone(persistedApproval));
      }

      return {
        ...(persistedApproval ? { approval: clone(persistedApproval) } : {}),
        ...(persistedApprovalDecision
          ? { approvalDecision: clone(persistedApprovalDecision) }
          : {}),
        ...(persistedCheckpoint
          ? { checkpoint: clone(persistedCheckpoint) }
          : {}),
        events: [...persistedEvents, ...checkpointEvents].map((event) =>
          clone(event),
        ),
        run: clone(transition.run),
      };
    },

    approvals: {
      async get(approvalId) {
        const approval = approvalsById.get(approvalId);

        return approval ? clone(approval) : undefined;
      },

      async getPendingByRunId(runId) {
        const runApprovals = (approvalsByRunId.get(runId) ?? [])
          .map((approvalId) => approvalsById.get(approvalId))
          .filter(
            (approval): approval is ApprovalRequest => approval !== undefined,
          );
        const pendingApproval = runApprovals.find(
          (approval) => approval.status === "pending",
        );

        return pendingApproval ? clone(pendingApproval) : undefined;
      },

      async listByRunId(runId) {
        return (approvalsByRunId.get(runId) ?? [])
          .map((approvalId) => approvalsById.get(approvalId))
          .filter(
            (approval): approval is ApprovalRequest => approval !== undefined,
          )
          .map((approval) => clone(approval));
      },
    },

    checkpoints: {
      async getLatestByRunId(runId) {
        const runCheckpoints = checkpoints.get(runId) ?? [];
        const latestCheckpoint = runCheckpoints.at(-1);

        return latestCheckpoint ? clone(latestCheckpoint) : undefined;
      },

      async listByRunId(runId) {
        return (checkpoints.get(runId) ?? []).map((checkpoint) =>
          clone(checkpoint),
        );
      },

      async save(checkpoint) {
        const runCheckpoints = checkpoints.get(checkpoint.runId) ?? [];
        const nextCheckpoint: WorkflowCheckpoint = {
          attempt: checkpoint.attempt,
          createdAt: checkpoint.createdAt,
          id: checkpoint.id ?? generateId("checkpoint"),
          nextStepIndex: checkpoint.nextStepIndex,
          ...(checkpoint.payload === undefined
            ? {}
            : { payload: checkpoint.payload }),
          reason: checkpoint.reason,
          runId: checkpoint.runId,
          sequence: runCheckpoints.length + 1,
          ...(checkpoint.stepId ? { stepId: checkpoint.stepId } : {}),
        };

        checkpoints.set(checkpoint.runId, [
          ...runCheckpoints,
          clone(nextCheckpoint),
        ]);

        return clone(nextCheckpoint);
      },
    },

    events: {
      async append(nextEvents) {
        const persistedEvents: RuntimeEvent[] = [];

        for (const nextEvent of nextEvents) {
          const runEvents = events.get(nextEvent.runId) ?? [];
          const persistedEvent = createPersistedEvent(
            nextEvent,
            runEvents.length + 1,
            generateId,
          );

          events.set(nextEvent.runId, [...runEvents, clone(persistedEvent)]);
          persistedEvents.push(persistedEvent);
        }

        return persistedEvents.map((event) => clone(event));
      },

      async listByRunId(runId) {
        return (events.get(runId) ?? []).map((event) => clone(event));
      },
    },

    runs: {
      async get(runId) {
        const run = runs.get(runId);

        return run ? clone(run) : undefined;
      },

      async list() {
        return [...runs.values()].map((run) => clone(run));
      },

      async put(run) {
        runs.set(run.id, clone(run));

        return clone(run);
      },
    },
  };
}

export function createFileRuntimePersistence(
  options: FileRuntimePersistenceOptions,
): RuntimePersistence {
  const filePath = resolve(options.filePath);
  let accessQueue = Promise.resolve();

  return {
    async commitTransition(transition) {
      return enqueueAccess(async () =>
        withMutablePersistence(filePath, options, (persistence) =>
          persistence.commitTransition(transition),
        ),
      );
    },

    approvals: {
      async get(approvalId) {
        return enqueueAccess(async () =>
          withReadOnlyPersistence(filePath, options, (persistence) =>
            persistence.approvals.get(approvalId),
          ),
        );
      },

      async getPendingByRunId(runId) {
        return enqueueAccess(async () =>
          withReadOnlyPersistence(filePath, options, (persistence) =>
            persistence.approvals.getPendingByRunId(runId),
          ),
        );
      },

      async listByRunId(runId) {
        return enqueueAccess(async () =>
          withReadOnlyPersistence(filePath, options, (persistence) =>
            persistence.approvals.listByRunId(runId),
          ),
        );
      },
    },

    checkpoints: {
      async getLatestByRunId(runId) {
        return enqueueAccess(async () =>
          withReadOnlyPersistence(filePath, options, (persistence) =>
            persistence.checkpoints.getLatestByRunId(runId),
          ),
        );
      },

      async listByRunId(runId) {
        return enqueueAccess(async () =>
          withReadOnlyPersistence(filePath, options, (persistence) =>
            persistence.checkpoints.listByRunId(runId),
          ),
        );
      },

      async save(checkpoint) {
        return enqueueAccess(async () =>
          withMutablePersistence(filePath, options, (persistence) =>
            persistence.checkpoints.save(checkpoint),
          ),
        );
      },
    },

    events: {
      async append(nextEvents) {
        return enqueueAccess(async () =>
          withMutablePersistence(filePath, options, (persistence) =>
            persistence.events.append(nextEvents),
          ),
        );
      },

      async listByRunId(runId) {
        return enqueueAccess(async () =>
          withReadOnlyPersistence(filePath, options, (persistence) =>
            persistence.events.listByRunId(runId),
          ),
        );
      },
    },

    runs: {
      async get(runId) {
        return enqueueAccess(async () =>
          withReadOnlyPersistence(filePath, options, (persistence) =>
            persistence.runs.get(runId),
          ),
        );
      },

      async list() {
        return enqueueAccess(async () =>
          withReadOnlyPersistence(filePath, options, (persistence) =>
            persistence.runs.list(),
          ),
        );
      },

      async put(run) {
        return enqueueAccess(async () =>
          withMutablePersistence(filePath, options, (persistence) =>
            persistence.runs.put(run),
          ),
        );
      },
    },
  };

  async function enqueueAccess<TValue>(
    accessOperation: () => Promise<TValue>,
  ): Promise<TValue> {
    const pendingAccess = accessQueue.then(accessOperation, accessOperation);
    accessQueue = pendingAccess.then(
      () => undefined,
      () => undefined,
    );

    return pendingAccess;
  }
}

export async function createRuntimePersistenceSnapshot(
  persistence: RuntimePersistence,
): Promise<RuntimePersistenceSnapshot> {
  const runs = await persistence.runs.list();
  const approvals: ApprovalRequest[] = [];
  const checkpoints: WorkflowCheckpoint[] = [];
  const events: RuntimeEvent[] = [];

  for (const run of runs) {
    approvals.push(...(await persistence.approvals.listByRunId(run.id)));
    checkpoints.push(...(await persistence.checkpoints.listByRunId(run.id)));
    events.push(...(await persistence.events.listByRunId(run.id)));
  }

  return {
    approvals: approvals.sort((left, right) =>
      left.requestedAt.localeCompare(right.requestedAt),
    ),
    checkpoints: checkpoints.sort(
      (left, right) => left.sequence - right.sequence,
    ),
    events: events.sort((left, right) => left.sequence - right.sequence),
    runs: runs.sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    ),
  };
}

async function withReadOnlyPersistence<TValue>(
  filePath: string,
  options: Pick<FileRuntimePersistenceOptions, "idGenerator">,
  action: (persistence: RuntimePersistence) => Promise<TValue>,
): Promise<TValue> {
  const snapshot = await readRuntimePersistenceSnapshot(filePath);
  const persistence = createInMemoryRuntimePersistence({
    ...(options.idGenerator ? { idGenerator: options.idGenerator } : {}),
    snapshot,
  });

  return action(persistence);
}

async function withMutablePersistence<TValue>(
  filePath: string,
  options: FileRuntimePersistenceOptions,
  action: (persistence: RuntimePersistence) => Promise<TValue>,
): Promise<TValue> {
  await ensureParentDirectory(filePath);

  return withFileLock(filePath, options, async () => {
    const snapshot = await readRuntimePersistenceSnapshot(filePath);
    const persistence = createInMemoryRuntimePersistence({
      ...(options.idGenerator ? { idGenerator: options.idGenerator } : {}),
      snapshot,
    });
    const result = await action(persistence);
    const nextSnapshot = await createRuntimePersistenceSnapshot(persistence);

    await writeRuntimePersistenceSnapshot(filePath, nextSnapshot);

    return result;
  });
}

function clone<TValue>(value: TValue): TValue {
  return structuredClone(value);
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), {
    recursive: true,
  });
}

async function readRuntimePersistenceSnapshot(
  filePath: string,
): Promise<RuntimePersistenceSnapshot> {
  try {
    const rawSnapshot = await readFile(filePath, "utf8");
    const parsedSnapshot = JSON.parse(
      rawSnapshot,
    ) as RuntimePersistenceSnapshot;

    return normalizeRuntimePersistenceSnapshot(parsedSnapshot);
  } catch (error) {
    if (isMissingFileError(error)) {
      return createEmptyRuntimePersistenceSnapshot();
    }

    throw error;
  }
}

function normalizeRuntimePersistenceSnapshot(
  snapshot: RuntimePersistenceSnapshot,
): RuntimePersistenceSnapshot {
  return {
    approvals: (snapshot.approvals ?? []).map((approval) => clone(approval)),
    checkpoints: (snapshot.checkpoints ?? []).map((checkpoint) =>
      clone(checkpoint),
    ),
    events: (snapshot.events ?? []).map((event) => clone(event)),
    runs: (snapshot.runs ?? []).map((run) => clone(run)),
  };
}

function createEmptyRuntimePersistenceSnapshot(): RuntimePersistenceSnapshot {
  return {
    approvals: [],
    checkpoints: [],
    events: [],
    runs: [],
  };
}

async function writeRuntimePersistenceSnapshot(
  filePath: string,
  snapshot: RuntimePersistenceSnapshot,
): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.bak`;

  await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  try {
    await rename(tempPath, filePath);

    return;
  } catch (error) {
    if (!isExistingFileError(error)) {
      throw error;
    }
  }

  await rm(backupPath, {
    force: true,
  });

  try {
    await rename(filePath, backupPath);
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, {
      force: true,
    });

    try {
      await rename(backupPath, filePath);
    } catch (restoreError) {
      if (!isMissingFileError(restoreError)) {
        throw restoreError;
      }
    }

    throw error;
  }

  await rm(backupPath, {
    force: true,
  });
}

async function withFileLock<TValue>(
  filePath: string,
  options: Pick<
    FileRuntimePersistenceOptions,
    "lockRetryDelayMs" | "lockTimeoutMs"
  >,
  action: () => Promise<TValue>,
): Promise<TValue> {
  const lockPath = `${filePath}.lock`;
  const retryDelayMs = options.lockRetryDelayMs ?? 25;
  const timeoutMs = options.lockTimeoutMs ?? 5_000;
  const startedAt = Date.now();

  while (true) {
    try {
      const lockHandle = await open(lockPath, "wx");

      try {
        return await action();
      } finally {
        await lockHandle.close();
        await rm(lockPath, {
          force: true,
        });
      }
    } catch (error) {
      if (!isExistingFileError(error)) {
        throw error;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(
          `Timed out waiting for runtime persistence lock at "${lockPath}".`,
        );
      }

      await delay(retryDelayMs);
    }
  }
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, durationMs);
  });
}

function isExistingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function seedInMemoryState(
  state: {
    readonly approvalsById: Map<ApprovalId, ApprovalRequest>;
    readonly approvalsByRunId: Map<RunId, ApprovalId[]>;
    readonly checkpoints: Map<RunId, WorkflowCheckpoint[]>;
    readonly events: Map<RunId, RuntimeEvent[]>;
    readonly runs: Map<RunId, WorkflowRun>;
  },
  snapshot?: RuntimePersistenceSnapshot,
): void {
  if (!snapshot) {
    return;
  }

  for (const run of snapshot.runs) {
    state.runs.set(run.id, clone(run));
  }

  for (const event of snapshot.events) {
    state.events.set(event.runId, [
      ...(state.events.get(event.runId) ?? []),
      clone(event),
    ]);
  }

  for (const checkpoint of snapshot.checkpoints) {
    state.checkpoints.set(checkpoint.runId, [
      ...(state.checkpoints.get(checkpoint.runId) ?? []),
      clone(checkpoint),
    ]);
  }

  for (const approval of snapshot.approvals) {
    state.approvalsById.set(approval.id, clone(approval));
    state.approvalsByRunId.set(approval.runId, [
      ...(state.approvalsByRunId.get(approval.runId) ?? []),
      approval.id,
    ]);
  }
}

function assertTransitionRunIds(
  transition: RuntimeTransitionCommit,
  approvalsById: ReadonlyMap<ApprovalId, ApprovalRequest>,
): ApprovalRequest | undefined {
  assertTransitionShape(transition, approvalsById);
  const runId = transition.run.id;

  for (const event of transition.events ?? []) {
    if (event.runId !== runId) {
      throw new Error(
        `Runtime transition commit received event for run "${event.runId}" while committing run "${runId}".`,
      );
    }
  }

  if (transition.checkpoint && transition.checkpoint.runId !== runId) {
    throw new Error(
      `Runtime transition commit received checkpoint for run "${transition.checkpoint.runId}" while committing run "${runId}".`,
    );
  }

  if (
    transition.approvalRequest &&
    transition.approvalRequest.runId !== runId
  ) {
    throw new Error(
      `Runtime transition commit received approval request for run "${transition.approvalRequest.runId}" while committing run "${runId}".`,
    );
  }

  if (!transition.approvalDecision) {
    return undefined;
  }

  const approval = approvalsById.get(transition.approvalDecision.approvalId);

  if (!approval) {
    throw new ApprovalNotFoundError(transition.approvalDecision.approvalId);
  }

  if (approval.runId !== runId) {
    throw new Error(
      `Runtime transition commit received approval decision for run "${approval.runId}" while committing run "${runId}".`,
    );
  }

  return approval;
}

function assertTransitionShape(
  transition: RuntimeTransitionCommit,
  approvalsById: ReadonlyMap<ApprovalId, ApprovalRequest>,
): void {
  if (transition.approvalRequest && transition.approvalDecision) {
    throw new Error(
      "Runtime transition commits may include either approvalRequest or approvalDecision, but not both.",
    );
  }

  if (
    transition.approvalRequest &&
    approvalsById.has(transition.approvalRequest.id)
  ) {
    throw new Error(
      `Approval "${transition.approvalRequest.id}" already exists in persistence.`,
    );
  }
}

function createCheckpointSavedEvent(
  checkpoint: WorkflowCheckpoint,
): RuntimeEventInput<"checkpoint.saved"> {
  return {
    name: "checkpoint.saved",
    occurredAt: checkpoint.createdAt,
    payload: {
      attempt: checkpoint.attempt,
      checkpointId: checkpoint.id,
      nextStepIndex: checkpoint.nextStepIndex,
      reason: checkpoint.reason,
    },
    runId: checkpoint.runId,
    ...(checkpoint.stepId ? { stepId: checkpoint.stepId } : {}),
  };
}

function decideExistingApproval(
  approval: ApprovalRequest | undefined,
  input: ApprovalDecisionInput,
) {
  if (!approval) {
    throw new ApprovalNotFoundError(input.approvalId);
  }

  return decideApproval(approval, input);
}

function createPersistedCheckpoint(
  checkpoint: CheckpointWrite,
  sequence: number,
  generateId: (prefix: "checkpoint" | "event") => string,
): WorkflowCheckpoint {
  return {
    attempt: checkpoint.attempt,
    createdAt: checkpoint.createdAt,
    id: checkpoint.id ?? generateId("checkpoint"),
    nextStepIndex: checkpoint.nextStepIndex,
    ...(checkpoint.payload === undefined
      ? {}
      : { payload: checkpoint.payload }),
    reason: checkpoint.reason,
    runId: checkpoint.runId,
    sequence,
    ...(checkpoint.stepId ? { stepId: checkpoint.stepId } : {}),
  };
}

function createPersistedEvent<TEventName extends RuntimeEventInput["name"]>(
  nextEvent: RuntimeEventInput<TEventName>,
  sequence: number,
  generateId: (prefix: "checkpoint" | "event") => string,
): RuntimeEvent<TEventName> {
  const baseEvent = {
    id: generateId("event"),
    name: nextEvent.name,
    occurredAt: nextEvent.occurredAt,
    payload: clone(nextEvent.payload),
    runId: nextEvent.runId,
    sequence,
  };

  if (!nextEvent.stepId) {
    return baseEvent;
  }

  return {
    ...baseEvent,
    stepId: nextEvent.stepId,
  };
}
