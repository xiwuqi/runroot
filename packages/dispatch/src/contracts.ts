import type { RunId } from "@runroot/domain";

export type DispatchJobKind = "resume_run" | "start_run";

export type DispatchJobStatus = "claimed" | "completed" | "failed" | "queued";

export interface DispatchJob {
  readonly attempts: number;
  readonly availableAt: string;
  readonly claimedAt?: string;
  readonly claimedBy?: string;
  readonly completedAt?: string;
  readonly definitionId: string;
  readonly enqueuedAt: string;
  readonly failureMessage?: string;
  readonly id: string;
  readonly kind: DispatchJobKind;
  readonly runId: RunId;
  readonly status: DispatchJobStatus;
}

export interface DispatchEnqueueInput {
  readonly availableAt?: string;
  readonly definitionId: string;
  readonly enqueuedAt: string;
  readonly kind: DispatchJobKind;
  readonly runId: RunId;
}

export interface DispatchClaimInput {
  readonly claimedAt: string;
  readonly workerId: string;
}

export interface DispatchQueue {
  claimNext(input: DispatchClaimInput): Promise<DispatchJob | undefined>;
  complete(
    jobId: string,
    completedAt: string,
  ): Promise<DispatchJob | undefined>;
  enqueue(input: DispatchEnqueueInput): Promise<DispatchJob>;
  fail(
    jobId: string,
    failedAt: string,
    failureMessage: string,
  ): Promise<DispatchJob | undefined>;
  get(jobId: string): Promise<DispatchJob | undefined>;
  list(status?: DispatchJobStatus): Promise<readonly DispatchJob[]>;
  listByRunId(runId: RunId): Promise<readonly DispatchJob[]>;
}
