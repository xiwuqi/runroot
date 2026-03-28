import type { PackageBoundary } from "@runroot/config";

export type {
  DispatchClaimInput,
  DispatchEnqueueInput,
  DispatchJob,
  DispatchJobKind,
  DispatchJobStatus,
  DispatchQueue,
} from "./contracts";
export {
  createInMemoryDispatchQueue,
  type InMemoryDispatchQueueOptions,
} from "./queue";

export const dispatchPackageBoundary = {
  name: "@runroot/dispatch",
  kind: "package",
  phaseOwned: 9,
  responsibility:
    "Shared queue and dispatch contracts for queued execution and worker coordination.",
  publicSurface: ["dispatch queue contract", "queue job model", "test queue"],
} as const satisfies PackageBoundary;
