import {
  awaitApproval,
  completeStep,
  type RuntimeStepContext,
  type WorkflowDefinition,
} from "@runroot/core-runtime";

import type { WorkflowTemplate } from "./contracts";

export function createGithubIssueTriageTemplate(): WorkflowTemplate {
  const definition: WorkflowDefinition = {
    id: "github-issue-triage",
    name: "GitHub Issue Triage",
    steps: [
      {
        execute: async (context: RuntimeStepContext) => {
          const result = await context.tools.invoke(
            {
              input: context.input,
              tool: {
                kind: "name",
                value: "github.issue_triage",
              },
            },
            {
              attempt: context.attempt,
              runId: context.run.id,
              source: "template.github-issue-triage",
              stepId: context.step.id,
            },
          );

          return completeStep(result.output);
        },
        key: "analyze-issue",
        name: "Analyze issue",
      },
      {
        execute: (context: RuntimeStepContext) => {
          const analysis = context.run.steps[0]?.output as
            | {
                readonly needsApproval?: boolean;
                readonly summary?: string;
              }
            | undefined;

          if (!analysis?.needsApproval) {
            return completeStep({
              status: "auto-approved",
            });
          }

          if (!context.checkpoint?.payload) {
            return awaitApproval({
              checkpointData: {
                approved: true,
              },
              note:
                analysis.summary ??
                "High-risk issue triage requires maintainer approval.",
              reviewer: {
                id: "github-maintainer",
              },
            });
          }

          return completeStep({
            status: "maintainer-approved",
          });
        },
        key: "approval-gate",
        name: "Approval gate",
      },
      {
        execute: (context: RuntimeStepContext) =>
          completeStep({
            approval: context.run.steps[1]?.output ?? null,
            issue: context.input,
            triage: context.run.steps[0]?.output ?? null,
          }),
        key: "finalize-triage",
        name: "Finalize triage",
      },
    ],
    version: "0.1.0",
  };

  return {
    definition,
    descriptor: {
      description:
        "Analyze an issue through an MCP-backed GitHub tool, pause for approval when risk is high, and finalize the triage output.",
      id: definition.id,
      inputExample: {
        issue: {
          body: "Production outage affecting login for multiple customers.",
          number: 418,
          title: "Production login outage",
        },
        repository: "acme/platform",
      },
      inputSchema: {
        additionalProperties: false,
        properties: {
          issue: {
            additionalProperties: false,
            properties: {
              body: { type: "string" },
              number: { type: "number" },
              title: { type: "string" },
            },
            required: ["number", "title", "body"],
            type: "object",
          },
          repository: { type: "string" },
        },
        required: ["repository", "issue"],
        type: "object",
      },
      name: definition.name,
      requiresApproval: true,
      toolReferences: ["github.issue_triage"],
      usesMcp: true,
    },
  };
}
