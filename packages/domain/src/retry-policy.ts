import { DomainInvariantError } from "./errors";

export type RetryStrategy = "constant" | "exponential";

export interface RetryPolicy {
  readonly backoffMultiplier: number;
  readonly delayMs: number;
  readonly maxAttempts: number;
  readonly maxDelayMs: number;
  readonly strategy: RetryStrategy;
}

export interface RetryPolicyInput {
  readonly backoffMultiplier?: number;
  readonly delayMs?: number;
  readonly maxAttempts?: number;
  readonly maxDelayMs?: number;
  readonly strategy?: RetryStrategy;
}

export const defaultRetryPolicy: RetryPolicy = {
  backoffMultiplier: 2,
  delayMs: 0,
  maxAttempts: 1,
  maxDelayMs: 30_000,
  strategy: "constant",
};

export function calculateRetryDelayMs(
  policy: RetryPolicy,
  failedAttemptNumber: number,
): number {
  if (failedAttemptNumber < 1) {
    throw new DomainInvariantError(
      `Retry attempt number must be at least 1. Received: ${failedAttemptNumber}.`,
    );
  }

  const rawDelay =
    policy.strategy === "constant"
      ? policy.delayMs
      : Math.round(
          policy.delayMs *
            policy.backoffMultiplier ** (failedAttemptNumber - 1),
        );

  return Math.min(rawDelay, policy.maxDelayMs);
}

export function resolveRetryPolicy(
  override?: RetryPolicyInput,
  basePolicy: RetryPolicy = defaultRetryPolicy,
): RetryPolicy {
  const resolved: RetryPolicy = {
    backoffMultiplier:
      override?.backoffMultiplier ?? basePolicy.backoffMultiplier,
    delayMs: override?.delayMs ?? basePolicy.delayMs,
    maxAttempts: override?.maxAttempts ?? basePolicy.maxAttempts,
    maxDelayMs: override?.maxDelayMs ?? basePolicy.maxDelayMs,
    strategy: override?.strategy ?? basePolicy.strategy,
  };

  validateRetryPolicy(resolved);

  return resolved;
}

function validateRetryPolicy(policy: RetryPolicy): void {
  if (policy.maxAttempts < 1) {
    throw new DomainInvariantError(
      `Retry policy maxAttempts must be at least 1. Received: ${policy.maxAttempts}.`,
    );
  }

  if (policy.delayMs < 0) {
    throw new DomainInvariantError(
      `Retry policy delayMs must be non-negative. Received: ${policy.delayMs}.`,
    );
  }

  if (policy.backoffMultiplier < 1) {
    throw new DomainInvariantError(
      `Retry policy backoffMultiplier must be at least 1. Received: ${policy.backoffMultiplier}.`,
    );
  }

  if (policy.maxDelayMs < 0) {
    throw new DomainInvariantError(
      `Retry policy maxDelayMs must be non-negative. Received: ${policy.maxDelayMs}.`,
    );
  }

  if (policy.maxDelayMs < policy.delayMs) {
    throw new DomainInvariantError(
      `Retry policy maxDelayMs must be greater than or equal to delayMs. Received: ${policy.maxDelayMs} < ${policy.delayMs}.`,
    );
  }
}
