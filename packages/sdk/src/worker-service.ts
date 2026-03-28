import {
  type PersistenceDriver,
  resolvePersistenceConfig,
} from "@runroot/config";
import { RuntimeEngine } from "@runroot/core-runtime";
import type { DispatchJob, DispatchQueue } from "@runroot/dispatch";
import type { WorkflowRun } from "@runroot/domain";
import type { RunrootLogger, RunrootTracer } from "@runroot/observability";
import {
  createConfiguredDispatchQueue,
  createConfiguredRuntimePersistence,
  createConfiguredToolHistoryStore,
  type RuntimePersistence,
} from "@runroot/persistence";
import {
  type CreateTemplateRuntimeBundleOptions,
  createTemplateRuntimeBundle,
  type TemplateCatalog,
} from "@runroot/templates";
import {
  type ToolHistoryStore,
  toolTelemetryMetadataKeys,
  withToolInvocationMetadata,
} from "@runroot/tools";
import { createToolTelemetryObserver } from "./tool-telemetry";

export interface RunrootWorkerServiceOptions {
  readonly approvalIdGenerator?: () => string;
  readonly databaseUrl?: string;
  readonly dispatchQueue?: DispatchQueue;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly idGenerator?: (prefix: "run" | "step") => string;
  readonly logger?: RunrootLogger;
  readonly now?: () => string;
  readonly persistence?: RuntimePersistence;
  readonly persistenceDriver?: PersistenceDriver;
  readonly sqlitePath?: string;
  readonly templates?: TemplateCatalog;
  readonly toolHistory?: ToolHistoryStore;
  readonly tracer?: RunrootTracer;
  readonly workerId?: string;
  readonly workspacePath?: string;
}

export interface WorkerProcessResult {
  readonly error?: string;
  readonly job: DispatchJob;
  readonly run?: WorkflowRun;
  readonly status: "completed" | "failed";
}

export interface RunrootWorkerService {
  processNextJob(): Promise<WorkerProcessResult | undefined>;
  runUntilIdle(limit?: number): Promise<readonly WorkerProcessResult[]>;
}

export function createRunrootWorkerService(
  options: RunrootWorkerServiceOptions = {},
): RunrootWorkerService {
  const now = options.now ?? (() => new Date().toISOString());
  const persistenceConfig = resolvePersistenceConfig({
    ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
    ...(options.env ? { env: options.env } : {}),
    ...(options.persistenceDriver ? { driver: options.persistenceDriver } : {}),
    ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
    ...(options.workspacePath ? { workspacePath: options.workspacePath } : {}),
  });
  const persistence =
    options.persistence ??
    createConfiguredRuntimePersistence({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const toolHistory =
    options.toolHistory ??
    createConfiguredToolHistoryStore({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const templateRuntimeOptions: CreateTemplateRuntimeBundleOptions = {
    toolObserver: createToolTelemetryObserver({
      history: toolHistory,
      ...(options.logger ? { logger: options.logger } : {}),
      surface: "worker",
      ...(options.tracer ? { tracer: options.tracer } : {}),
    }),
  };
  const templateRuntime = createTemplateRuntimeBundle(templateRuntimeOptions);
  const templates = options.templates ?? templateRuntime.templates;
  const dispatchQueue =
    options.dispatchQueue ??
    createConfiguredDispatchQueue({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const workerId =
    options.workerId ??
    options.env?.RUNROOT_WORKER_ID ??
    `worker:${persistenceConfig.driver}`;
  const runtime = createRuntime({
    [toolTelemetryMetadataKeys.executionMode]: "queued",
    [toolTelemetryMetadataKeys.workerId]: workerId,
  });

  return {
    async processNextJob() {
      const claimedAt = now();
      const claimedJob = await dispatchQueue.claimNext({
        claimedAt,
        workerId,
      });

      if (!claimedJob) {
        return undefined;
      }

      try {
        const run = await runtime.getRun(claimedJob.runId);

        if (!run) {
          return failClaimedJob(
            claimedJob,
            dispatchQueue,
            now(),
            `Run "${claimedJob.runId}" was not found.`,
          );
        }

        const template = templates.get(run.definitionId);

        if (!template) {
          return failClaimedJob(
            claimedJob,
            dispatchQueue,
            now(),
            `Template "${run.definitionId}" was not found.`,
          );
        }

        const nextRun = await executeClaimedJob(
          claimedJob,
          run,
          createRuntime({
            [toolTelemetryMetadataKeys.dispatchJobId]: claimedJob.id,
            [toolTelemetryMetadataKeys.executionMode]: "queued",
            [toolTelemetryMetadataKeys.workerId]: workerId,
          }),
          {
            definition: template.definition,
          },
        );
        const completedJob =
          (await dispatchQueue.complete(claimedJob.id, now())) ?? claimedJob;

        return {
          job: completedJob,
          run: nextRun,
          status: "completed",
        };
      } catch (error) {
        return failClaimedJob(
          claimedJob,
          dispatchQueue,
          now(),
          error instanceof Error ? error.message : String(error),
        );
      }
    },

    async runUntilIdle(limit = 100) {
      const results: WorkerProcessResult[] = [];

      while (results.length < limit) {
        const nextResult = await this.processNextJob();

        if (!nextResult) {
          break;
        }

        results.push(nextResult);
      }

      return results;
    },
  };

  function createRuntime(
    metadata: Readonly<Record<string, string>>,
  ): RuntimeEngine {
    return new RuntimeEngine({
      ...(options.approvalIdGenerator
        ? { approvalIdGenerator: options.approvalIdGenerator }
        : {}),
      ...(options.idGenerator ? { idGenerator: options.idGenerator } : {}),
      now,
      persistence,
      toolInvoker: withToolInvocationMetadata(
        templateRuntime.toolInvoker,
        metadata,
      ),
    });
  }
}

async function executeClaimedJob(
  job: DispatchJob,
  run: WorkflowRun,
  runtime: RuntimeEngine,
  options: {
    readonly definition: Parameters<RuntimeEngine["executeRun"]>[0];
  },
): Promise<WorkflowRun> {
  switch (job.kind) {
    case "resume_run": {
      if (run.status === "paused") {
        return runtime.resumeRun(options.definition, run.id);
      }

      if (run.status === "queued") {
        return runtime.executeRun(options.definition, run.id);
      }

      return run;
    }
    case "start_run": {
      if (run.status === "pending" || run.status === "queued") {
        return runtime.executeRun(options.definition, run.id);
      }

      return run;
    }
  }
}

async function failClaimedJob(
  claimedJob: DispatchJob,
  dispatchQueue: DispatchQueue,
  failedAt: string,
  error: string,
): Promise<WorkerProcessResult> {
  const failedJob =
    (await dispatchQueue.fail(claimedJob.id, failedAt, error)) ?? claimedJob;

  return {
    error,
    job: failedJob,
    status: "failed",
  };
}
