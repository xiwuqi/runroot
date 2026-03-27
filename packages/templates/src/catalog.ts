import type {
  TemplateCatalog,
  TemplateRuntimeBundle,
  WorkflowTemplate,
} from "./contracts";
import { TemplateNotFoundError } from "./errors";
import { createGithubIssueTriageTemplate } from "./github-issue-triage";
import { createPullRequestReviewTemplate } from "./pr-review";
import { createShellRunbookTemplate } from "./shell-runbook";
import { createSlackApprovalTemplate } from "./slack-approval";
import { createTemplateToolInvoker } from "./tools";

export function createTemplateCatalog(
  templates: readonly WorkflowTemplate[] = defaultTemplates,
): TemplateCatalog {
  const templatesById = new Map(
    templates.map((template) => [template.descriptor.id, template] as const),
  );

  return {
    get(templateId) {
      return templatesById.get(templateId);
    },
    list() {
      return [...templatesById.values()];
    },
    require(templateId) {
      const template = templatesById.get(templateId);

      if (!template) {
        throw new TemplateNotFoundError(templateId);
      }

      return template;
    },
  };
}

export function createTemplateRuntimeBundle(): TemplateRuntimeBundle {
  return {
    templates: createTemplateCatalog(),
    toolInvoker: createTemplateToolInvoker(),
  };
}

const defaultTemplates = [
  createGithubIssueTriageTemplate(),
  createPullRequestReviewTemplate(),
  createSlackApprovalTemplate(),
  createShellRunbookTemplate(),
] as const satisfies readonly WorkflowTemplate[];
