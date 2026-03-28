import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { JsonValue } from "@runroot/domain";
import { adaptMcpToolDescriptor, type McpToolClient } from "@runroot/mcp";
import {
  createEchoTool,
  createRegistryToolInvoker,
  createToolRegistry,
  type ToolDefinition,
  type ToolInvocationObserver,
  type ToolInvoker,
} from "@runroot/tools";

const execFileAsync = promisify(execFile);

export interface CreateTemplateToolInvokerOptions {
  readonly observer?:
    | ToolInvocationObserver
    | readonly ToolInvocationObserver[];
}

export function createTemplateToolInvoker(
  options: CreateTemplateToolInvokerOptions = {},
): ToolInvoker {
  const registry = createToolRegistry([
    createEchoTool(),
    createShellRunbookTool(),
    createSlackNotifyTool(),
    ...createGithubMcpTools(),
  ]);

  return createRegistryToolInvoker({
    ...(options.observer ? { observer: options.observer } : {}),
    registry,
  });
}

function createGithubMcpTools(): readonly ToolDefinition[] {
  const client = createMockGithubMcpClient();
  const descriptors = createMockGithubDescriptors();

  return descriptors.map((descriptor) =>
    adaptMcpToolDescriptor(client, descriptor, {
      capabilities: ["template.demo"],
      namePrefix: "github",
      providerId: "mock-github",
      tags: ["template", "mcp", "github"],
    }),
  );
}

function createMockGithubMcpClient(): McpToolClient {
  const descriptors = createMockGithubDescriptors();

  return {
    async callTool(request) {
      const descriptor = descriptors.find(
        (candidate) => candidate.name === request.name,
      );

      if (!descriptor) {
        throw new Error(`Unknown mock GitHub MCP tool "${request.name}".`);
      }

      const input = request.input as Record<string, JsonValue>;

      if (request.name === "issue_triage") {
        const issue = input.issue as Record<string, JsonValue>;
        const issueText =
          `${String(issue.title ?? "")} ${String(issue.body ?? "")}`.toLowerCase();
        const needsApproval =
          issueText.includes("security") ||
          issueText.includes("outage") ||
          issueText.includes("production");

        return {
          output: {
            labels: needsApproval
              ? ["bug", "urgent", "needs-review"]
              : ["triaged", "ready"],
            needsApproval,
            severity: needsApproval ? "high" : "normal",
            summary: needsApproval
              ? "High-risk issue requires maintainer approval before triage is finalized."
              : "Issue can be triaged automatically.",
          },
        };
      }

      const pr = input.pr as Record<string, JsonValue>;
      const diffSummary = String(pr.diffSummary ?? "").toLowerCase();
      const riskyChange =
        diffSummary.includes("migration") ||
        diffSummary.includes("database") ||
        diffSummary.includes("auth");

      return {
        output: {
          findingCount: riskyChange ? 2 : 0,
          recommendation: riskyChange ? "request_changes" : "approve",
          riskLevel: riskyChange ? "high" : "low",
          summary: riskyChange
            ? "Review found risky changes that should be inspected by a maintainer."
            : "No risky changes detected in the PR summary.",
        },
      };
    },
    async listTools() {
      return descriptors;
    },
  };
}

function createMockGithubDescriptors() {
  return [
    {
      capabilities: ["github.read"],
      description: "Analyze a GitHub issue and return triage guidance.",
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
      name: "issue_triage",
      output: {
        description: "Suggested labels and severity for the issue.",
        schema: {
          additionalProperties: false,
          properties: {
            labels: {
              items: { type: "string" },
              type: "array",
            },
            needsApproval: { type: "boolean" },
            severity: { type: "string" },
            summary: { type: "string" },
          },
          required: ["labels", "needsApproval", "severity", "summary"],
          type: "object",
        },
      },
      tags: ["github", "issue", "triage"],
    },
    {
      capabilities: ["github.read"],
      description: "Review a pull request summary and recommend an action.",
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
      name: "pr_review",
      output: {
        description: "Recommended PR review outcome.",
        schema: {
          additionalProperties: false,
          properties: {
            findingCount: { type: "number" },
            recommendation: { type: "string" },
            riskLevel: { type: "string" },
            summary: { type: "string" },
          },
          required: ["findingCount", "recommendation", "riskLevel", "summary"],
          type: "object",
        },
      },
      tags: ["github", "pr", "review"],
    },
  ] as const;
}

function createShellRunbookTool(): ToolDefinition {
  return {
    inputSchema: {
      additionalProperties: false,
      properties: {
        action: {
          minLength: 1,
          type: "string",
        },
      },
      required: ["action"],
      type: "object",
    },
    invoke: async ({ input }) => {
      const action = String((input as Record<string, JsonValue>).action);
      const command = resolveRunbookCommand(action);
      const result = await execFileAsync(command.file, command.args, {
        cwd: process.cwd(),
      });

      return {
        action,
        exitCode: 0,
        stderr: result.stderr.trim(),
        stdout: result.stdout.trim(),
      };
    },
    metadata: {
      capabilities: ["shell.local"],
      description: "Execute a small, allowlisted local runbook command.",
      id: "builtin.shell.runbook",
      name: "shell.runbook",
      source: "builtin",
      tags: ["builtin", "shell", "runbook"],
    },
    output: {
      description: "Captured output from the local runbook command.",
      schema: {
        additionalProperties: false,
        properties: {
          action: { type: "string" },
          exitCode: { type: "number" },
          stderr: { type: "string" },
          stdout: { type: "string" },
        },
        required: ["action", "exitCode", "stderr", "stdout"],
        type: "object",
      },
    },
  };
}

function resolveRunbookCommand(action: string) {
  switch (action) {
    case "node-version":
      return {
        args: ["--version"],
        file: process.execPath,
      };
    case "print-ready":
      return {
        args: ["-e", "console.log('runroot shell runbook ready')"],
        file: process.execPath,
      };
    default:
      throw new Error(
        `Unsupported shell runbook action "${action}". Allowed actions are "node-version" and "print-ready".`,
      );
  }
}

function createSlackNotifyTool(): ToolDefinition {
  return {
    inputSchema: {
      additionalProperties: false,
      properties: {
        channel: {
          minLength: 1,
          type: "string",
        },
        message: {
          minLength: 1,
          type: "string",
        },
      },
      required: ["channel", "message"],
      type: "object",
    },
    invoke: ({ input }) => {
      const slackInput = input as {
        readonly channel: string;
        readonly message: string;
      };

      return {
        channel: slackInput.channel,
        delivered: true,
        message: slackInput.message,
        messageId: `slack-${Buffer.from(slackInput.channel).toString("hex").slice(0, 8)}`,
      };
    },
    metadata: {
      capabilities: ["slack.write"],
      description: "Record a Slack-style notification for workflow demos.",
      id: "builtin.slack.notify",
      name: "slack.notify",
      source: "builtin",
      tags: ["builtin", "slack", "notification"],
    },
    output: {
      description: "Normalized Slack notification result.",
      schema: {
        additionalProperties: false,
        properties: {
          channel: { type: "string" },
          delivered: { type: "boolean" },
          message: { type: "string" },
          messageId: { type: "string" },
        },
        required: ["channel", "delivered", "message", "messageId"],
        type: "object",
      },
    },
  };
}
