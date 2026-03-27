import {
  awaitApproval,
  completeStep,
  type RuntimeStepContext,
  type WorkflowDefinition,
} from "@runroot/core-runtime";

import type { WorkflowTemplate } from "./contracts";

export function createSlackApprovalTemplate(): WorkflowTemplate {
  const definition: WorkflowDefinition = {
    id: "slack-approval-flow",
    name: "Slack Approval Flow",
    steps: [
      {
        execute: async (context: RuntimeStepContext) => {
          const input = context.input as {
            readonly channel: string;
            readonly operation: string;
            readonly summary: string;
          };

          const result = await context.tools.invoke(
            {
              input: {
                channel: input.channel,
                message: `Approval requested for ${input.operation}: ${input.summary}`,
              },
              tool: {
                kind: "name",
                value: "slack.notify",
              },
            },
            {
              attempt: context.attempt,
              runId: context.run.id,
              source: "template.slack-approval-flow",
              stepId: context.step.id,
            },
          );

          return completeStep(result.output);
        },
        key: "announce-request",
        name: "Announce request",
      },
      {
        execute: (context: RuntimeStepContext) => {
          const input = context.input as {
            readonly operation: string;
            readonly reviewerId?: string;
          };

          if (!context.checkpoint?.payload) {
            return awaitApproval({
              checkpointData: {
                acknowledged: true,
              },
              note: `Approve workflow operation "${input.operation}".`,
              ...(input.reviewerId
                ? {
                    reviewer: {
                      id: input.reviewerId,
                    },
                  }
                : {}),
            });
          }

          return completeStep({
            status: "approved",
          });
        },
        key: "await-approval",
        name: "Await approval",
      },
      {
        execute: async (context: RuntimeStepContext) => {
          const input = context.input as {
            readonly channel: string;
            readonly operation: string;
          };
          const result = await context.tools.invoke(
            {
              input: {
                channel: input.channel,
                message: `Approval received. Resuming ${input.operation}.`,
              },
              tool: {
                kind: "name",
                value: "slack.notify",
              },
            },
            {
              attempt: context.attempt,
              runId: context.run.id,
              source: "template.slack-approval-flow",
              stepId: context.step.id,
            },
          );

          return completeStep(result.output);
        },
        key: "announce-resume",
        name: "Announce resume",
      },
    ],
    version: "0.1.0",
  };

  return {
    definition,
    descriptor: {
      description:
        "Request approval, pause the run, and resume after the operator records a decision while keeping Slack notifications as plain tools.",
      id: definition.id,
      inputExample: {
        channel: "#ops-approvals",
        operation: "deploy staging",
        reviewerId: "ops-oncall",
        summary: "Promote build 2026.03.27-1 to staging.",
      },
      inputSchema: {
        additionalProperties: false,
        properties: {
          channel: { type: "string" },
          operation: { type: "string" },
          reviewerId: { type: "string" },
          summary: { type: "string" },
        },
        required: ["channel", "operation", "summary"],
        type: "object",
      },
      name: definition.name,
      requiresApproval: true,
      toolReferences: ["slack.notify"],
      usesMcp: false,
    },
  };
}
