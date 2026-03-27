import {
  completeStep,
  type RuntimeStepContext,
  type WorkflowDefinition,
} from "@runroot/core-runtime";

import type { WorkflowTemplate } from "./contracts";

export function createPullRequestReviewTemplate(): WorkflowTemplate {
  const definition: WorkflowDefinition = {
    id: "pr-review-flow",
    name: "PR Review Flow",
    steps: [
      {
        execute: async (context: RuntimeStepContext) => {
          const result = await context.tools.invoke(
            {
              input: context.input,
              tool: {
                kind: "name",
                value: "github.pr_review",
              },
            },
            {
              attempt: context.attempt,
              runId: context.run.id,
              source: "template.pr-review-flow",
              stepId: context.step.id,
            },
          );

          return completeStep(result.output);
        },
        key: "review-pr",
        name: "Review PR",
      },
      {
        execute: (context: RuntimeStepContext) =>
          completeStep({
            pr: context.input,
            review: context.run.steps[0]?.output ?? null,
          }),
        key: "publish-review",
        name: "Publish review",
      },
    ],
    version: "0.1.0",
  };

  return {
    definition,
    descriptor: {
      description:
        "Review a pull request through a minimal MCP-backed GitHub review tool and publish a structured summary.",
      id: definition.id,
      inputExample: {
        pr: {
          diffSummary:
            "Adds auth middleware and a database migration for roles.",
          number: 42,
          title: "Improve RBAC role handling",
        },
        repository: "acme/platform",
      },
      inputSchema: {
        additionalProperties: false,
        properties: {
          pr: {
            additionalProperties: false,
            properties: {
              diffSummary: { type: "string" },
              number: { type: "number" },
              title: { type: "string" },
            },
            required: ["number", "title", "diffSummary"],
            type: "object",
          },
          repository: { type: "string" },
        },
        required: ["repository", "pr"],
        type: "object",
      },
      name: definition.name,
      requiresApproval: false,
      toolReferences: ["github.pr_review"],
      usesMcp: true,
    },
  };
}
