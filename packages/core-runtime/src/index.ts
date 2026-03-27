import type { PackageBoundary } from "@runroot/config";

export {
  type CompletedStepResult,
  completeStep,
  type PausedStepResult,
  pauseStep,
  type RuntimeStepContext,
  type StepExecutionResult,
  type WorkflowDefinition,
  type WorkflowStepDefinition,
} from "./runtime-definition";
export {
  type CreateRunOptions,
  RuntimeEngine,
  type RuntimeEngineOptions,
  RuntimeExecutionError,
} from "./runtime-engine";

export const coreRuntimePackageBoundary = {
  name: "@runroot/core-runtime",
  kind: "package",
  phaseOwned: 2,
  responsibility:
    "Framework-independent runtime orchestration and state transition execution.",
  publicSurface: [
    "runtime engine",
    "checkpoint coordination",
    "retry policy",
    "tool invoker seam",
  ],
} as const satisfies PackageBoundary;
