import type { PackageBoundary } from "@runroot/config";

export {
  OperatorConflictError,
  OperatorError,
  OperatorInputError,
  OperatorNotFoundError,
} from "./errors";
export {
  type AcknowledgeAuditCatalogEntryInput,
  type AssignAuditCatalogEntryInput,
  type AttestAuditCatalogEntryInput,
  type BlockAuditCatalogEntryInput,
  type ChecklistAuditCatalogEntryInput,
  createRunrootOperatorService,
  createRunTimelineService,
  type DecideApprovalInput,
  type PendingApprovalSummary,
  type ProgressAuditCatalogEntryInput,
  type PublishAuditViewCatalogEntryInput,
  type RecordAuditCatalogEntryEvidenceInput,
  type ResolveAuditCatalogEntryInput,
  type ReviewAuditCatalogEntryInput,
  type RunrootOperatorService,
  type RunrootOperatorServiceOptions,
  resolveWorkspacePath,
  type SaveAuditSavedViewInput,
  type SignOffAuditCatalogEntryInput,
  type StartTemplateRunInput,
  type VerifyAuditCatalogEntryInput,
} from "./operator-service";
export {
  createRunrootWorkerService,
  type RunrootWorkerService,
  type RunrootWorkerServiceOptions,
  type WorkerProcessResult,
} from "./worker-service";

export const sdkPackageBoundary = {
  name: "@runroot/sdk",
  kind: "package",
  phaseOwned: 5,
  responsibility:
    "Programmatic client APIs for interacting with Runroot services.",
  publicSurface: ["client SDK", "typed request models", "helper utilities"],
} as const satisfies PackageBoundary;
