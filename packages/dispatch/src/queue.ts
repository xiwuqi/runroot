import { randomUUID } from "node:crypto";

import type { DispatchJob, DispatchQueue } from "./contracts";

export interface InMemoryDispatchQueueOptions {
  readonly idGenerator?: () => string;
  readonly snapshot?: readonly DispatchJob[];
}

export function createInMemoryDispatchQueue(
  options: InMemoryDispatchQueueOptions = {},
): DispatchQueue {
  const jobs = new Map<string, DispatchJob>();
  const idGenerator = options.idGenerator ?? (() => `dispatch_${randomUUID()}`);

  for (const snapshotJob of options.snapshot ?? []) {
    jobs.set(snapshotJob.id, clone(snapshotJob));
  }

  return {
    async claimNext(input) {
      const nextJob = [...jobs.values()]
        .filter(
          (job) =>
            job.status === "queued" &&
            job.availableAt.localeCompare(input.claimedAt) <= 0,
        )
        .sort(compareJobs)[0];

      if (!nextJob) {
        return undefined;
      }

      const claimedJob: DispatchJob = {
        ...nextJob,
        attempts: nextJob.attempts + 1,
        claimedAt: input.claimedAt,
        claimedBy: input.workerId,
        status: "claimed",
      };

      jobs.set(claimedJob.id, claimedJob);

      return clone(claimedJob);
    },

    async complete(jobId, completedAt) {
      const job = jobs.get(jobId);

      if (!job) {
        return undefined;
      }

      const completedJob: DispatchJob = {
        ...job,
        completedAt,
        status: "completed",
      };

      jobs.set(jobId, completedJob);

      return clone(completedJob);
    },

    async enqueue(input) {
      const queuedJob: DispatchJob = {
        attempts: 0,
        availableAt: input.availableAt ?? input.enqueuedAt,
        definitionId: input.definitionId,
        enqueuedAt: input.enqueuedAt,
        id: idGenerator(),
        kind: input.kind,
        runId: input.runId,
        status: "queued",
      };

      jobs.set(queuedJob.id, queuedJob);

      return clone(queuedJob);
    },

    async fail(jobId, failedAt, failureMessage) {
      const job = jobs.get(jobId);

      if (!job) {
        return undefined;
      }

      const failedJob: DispatchJob = {
        ...job,
        completedAt: failedAt,
        failureMessage,
        status: "failed",
      };

      jobs.set(jobId, failedJob);

      return clone(failedJob);
    },

    async get(jobId) {
      const job = jobs.get(jobId);

      return job ? clone(job) : undefined;
    },

    async list(status) {
      return [...jobs.values()]
        .filter((job) => (status ? job.status === status : true))
        .sort(compareJobs)
        .map((job) => clone(job));
    },

    async listByRunId(runId) {
      return [...jobs.values()]
        .filter((job) => job.runId === runId)
        .sort(compareJobs)
        .map((job) => clone(job));
    },
  };
}

function compareJobs(left: DispatchJob, right: DispatchJob): number {
  return (
    left.availableAt.localeCompare(right.availableAt) ||
    left.enqueuedAt.localeCompare(right.enqueuedAt) ||
    left.id.localeCompare(right.id)
  );
}

function clone<TValue>(value: TValue): TValue {
  return structuredClone(value);
}
