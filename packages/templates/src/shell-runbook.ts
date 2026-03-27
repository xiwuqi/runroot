import {
  awaitApproval,
  completeStep,
  type RuntimeStepContext,
  type WorkflowDefinition,
} from "@runroot/core-runtime";

import type { WorkflowTemplate } from "./contracts";

export function createShellRunbookTemplate(): WorkflowTemplate {
  const definition: WorkflowDefinition = {
    id: "shell-runbook-flow",
    name: "Shell Runbook Flow",
    steps: [
      {
        execute: async (context: RuntimeStepContext) => {
          const result = await context.tools.invoke(
            {
              input: {
                action: "node-version",
              },
              tool: {
                kind: "name",
                value: "shell.runbook",
              },
            },
            {
              attempt: context.attempt,
              runId: context.run.id,
              source: "template.shell-runbook-flow",
              stepId: context.step.id,
            },
          );

          return completeStep(result.output);
        },
        key: "precheck",
        name: "Precheck",
      },
      {
        execute: (context: RuntimeStepContext) => {
          const input = context.input as {
            readonly approvalRequired?: boolean;
            readonly runbookId: string;
          };

          if (!input.approvalRequired) {
            return completeStep({
              status: "not-required",
            });
          }

          if (!context.checkpoint?.payload) {
            return awaitApproval({
              checkpointData: {
                approved: true,
              },
              note: `Approve shell runbook "${input.runbookId}".`,
              reviewer: {
                id: "ops-oncall",
              },
            });
          }

          return completeStep({
            status: "approved",
          });
        },
        key: "approval-gate",
        name: "Approval gate",
      },
      {
        execute: async (context: RuntimeStepContext) => {
          const input = context.input as {
            readonly commandAlias?: string;
          };
          const result = await context.tools.invoke(
            {
              input: {
                action: input.commandAlias ?? "print-ready",
              },
              tool: {
                kind: "name",
                value: "shell.runbook",
              },
            },
            {
              attempt: context.attempt,
              runId: context.run.id,
              source: "template.shell-runbook-flow",
              stepId: context.step.id,
            },
          );

          return completeStep(result.output);
        },
        key: "execute-runbook",
        name: "Execute runbook",
      },
    ],
    version: "0.1.0",
  };

  return {
    definition,
    descriptor: {
      description:
        "Run a small allowlisted shell runbook with an optional approval gate and replayable timeline.",
      id: definition.id,
      inputExample: {
        approvalRequired: false,
        commandAlias: "print-ready",
        runbookId: "node-health-check",
      },
      inputSchema: {
        additionalProperties: false,
        properties: {
          approvalRequired: { type: "boolean" },
          commandAlias: { type: "string" },
          runbookId: { type: "string" },
        },
        required: ["runbookId"],
        type: "object",
      },
      name: definition.name,
      requiresApproval: true,
      toolReferences: ["shell.runbook"],
      usesMcp: false,
    },
  };
}
