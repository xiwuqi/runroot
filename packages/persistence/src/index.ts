import type { PackageBoundary } from "@runroot/config";

export {
  type CheckpointRepository,
  type CheckpointWrite,
  createInMemoryRuntimePersistence,
  type EventRepository,
  type InMemoryRuntimePersistenceOptions,
  type RunRepository,
  type RuntimePersistence,
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
