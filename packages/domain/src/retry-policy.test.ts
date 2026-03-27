import { describe, expect, it } from "vitest";

import {
  calculateRetryDelayMs,
  defaultRetryPolicy,
  resolveRetryPolicy,
} from "./retry-policy";

describe("@runroot/domain retry policy", () => {
  it("resolves overrides against the base policy", () => {
    expect(
      resolveRetryPolicy({
        delayMs: 500,
        maxAttempts: 4,
        strategy: "exponential",
      }),
    ).toEqual({
      backoffMultiplier: 2,
      delayMs: 500,
      maxAttempts: 4,
      maxDelayMs: 30_000,
      strategy: "exponential",
    });
  });

  it("calculates exponential backoff using the failed attempt number", () => {
    const policy = resolveRetryPolicy({
      backoffMultiplier: 3,
      delayMs: 100,
      maxAttempts: 5,
      maxDelayMs: 10_000,
      strategy: "exponential",
    });

    expect(calculateRetryDelayMs(policy, 1)).toBe(100);
    expect(calculateRetryDelayMs(policy, 2)).toBe(300);
    expect(calculateRetryDelayMs(policy, 3)).toBe(900);
  });

  it("caps retry delay at maxDelayMs", () => {
    const policy = resolveRetryPolicy({
      ...defaultRetryPolicy,
      backoffMultiplier: 4,
      delayMs: 2_000,
      maxDelayMs: 5_000,
      strategy: "exponential",
    });

    expect(calculateRetryDelayMs(policy, 2)).toBe(5_000);
  });
});
