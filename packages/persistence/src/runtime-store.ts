import { randomUUID } from "node:crypto";

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
  readonly checkpoints: CheckpointRepository;
  commitTransition(
    transition: RuntimeTransitionCommit,
  ): Promise<RuntimeTransitionCommitResult>;
  readonly events: EventRepository;
  readonly runs: RunRepository;
}

export interface InMemoryRuntimePersistenceOptions {
  readonly idGenerator?: (prefix: "checkpoint" | "event") => string;
}

export interface RuntimeTransitionCommit {
  readonly checkpoint?: CheckpointWrite;
  readonly events?: readonly RuntimeEventInput[];
  readonly run: WorkflowRun;
}

export interface RuntimeTransitionCommitResult {
  readonly checkpoint?: WorkflowCheckpoint;
  readonly events: readonly RuntimeEvent[];
  readonly run: WorkflowRun;
}

export function createInMemoryRuntimePersistence(
  options: InMemoryRuntimePersistenceOptions = {},
): RuntimePersistence {
  const runs = new Map<RunId, WorkflowRun>();
  const events = new Map<RunId, RuntimeEvent[]>();
  const checkpoints = new Map<RunId, WorkflowCheckpoint[]>();

  const generateId =
    options.idGenerator ??
    ((prefix: "checkpoint" | "event") => `${prefix}_${randomUUID()}`);

  return {
    async commitTransition(transition) {
      assertTransitionRunIds(transition);

      const nextEvents = transition.events ?? [];
      const existingRunEvents = events.get(transition.run.id) ?? [];
      const existingCheckpoints = checkpoints.get(transition.run.id) ?? [];

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

      return {
        ...(persistedCheckpoint
          ? { checkpoint: clone(persistedCheckpoint) }
          : {}),
        events: [...persistedEvents, ...checkpointEvents].map((event) =>
          clone(event),
        ),
        run: clone(transition.run),
      };
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

function clone<TValue>(value: TValue): TValue {
  return structuredClone(value);
}

function assertTransitionRunIds(transition: RuntimeTransitionCommit): void {
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
