import type { PackageBoundary } from "@runroot/config";

export {
  createTemplateCatalog,
  createTemplateRuntimeBundle,
} from "./catalog";
export type {
  CreateTemplateRuntimeBundleOptions,
  TemplateCatalog,
  TemplateRuntimeBundle,
  WorkflowTemplate,
  WorkflowTemplateDescriptor,
} from "./contracts";
export { TemplateError, TemplateNotFoundError } from "./errors";
export { createGithubIssueTriageTemplate } from "./github-issue-triage";
export { createPullRequestReviewTemplate } from "./pr-review";
export { createShellRunbookTemplate } from "./shell-runbook";
export { createSlackApprovalTemplate } from "./slack-approval";
export { createTemplateToolInvoker } from "./tools";

export const templatesPackageBoundary = {
  name: "@runroot/templates",
  kind: "package",
  phaseOwned: 5,
  responsibility: "Workflow templates and template assembly helpers.",
  publicSurface: [
    "template definitions",
    "template manifests",
    "assembly helpers",
  ],
} as const satisfies PackageBoundary;
