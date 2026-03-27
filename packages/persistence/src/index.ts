import type { PackageBoundary } from "@runroot/config";

export {
  type ApprovalRepository,
  type CheckpointRepository,
  type CheckpointWrite,
  createFileRuntimePersistence,
  createInMemoryRuntimePersistence,
  createRuntimePersistenceSnapshot,
  type EventRepository,
  type FileRuntimePersistenceOptions,
  type InMemoryRuntimePersistenceOptions,
  type RunRepository,
  type RuntimePersistence,
  type RuntimePersistenceSnapshot,
  type RuntimeTransitionCommit,
  type RuntimeTransitionCommitResult,
} from "./runtime-store";

export const persistencePackageBoundary = {
  name: "@runroot/persistence",
  kind: "package",
  phaseOwned: 2,
  responsibility:
    "Repository contracts, checkpoint storage, and database adapter seams.",
  publicSurface: [
    "repository interfaces",
    "storage adapters",
    "checkpoint persistence",
  ],
} as const satisfies PackageBoundary;
