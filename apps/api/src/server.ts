import cors from "@fastify/cors";
import { approvalsPackageBoundary } from "@runroot/approvals";
import { cliPackageBoundary } from "@runroot/cli";
import { projectMetadata, requiredQualityCommands } from "@runroot/config";
import { coreRuntimePackageBoundary } from "@runroot/core-runtime";
import { domainPackageBoundary } from "@runroot/domain";
import { eventsPackageBoundary } from "@runroot/events";
import { mcpPackageBoundary } from "@runroot/mcp";
import { observabilityPackageBoundary } from "@runroot/observability";
import { persistencePackageBoundary } from "@runroot/persistence";
import { replayPackageBoundary } from "@runroot/replay";
import { sdkPackageBoundary } from "@runroot/sdk";
import { templatesPackageBoundary } from "@runroot/templates";
import { toolsPackageBoundary } from "@runroot/tools";
import Fastify from "fastify";

export const packageBoundaries = [
  domainPackageBoundary,
  coreRuntimePackageBoundary,
  persistencePackageBoundary,
  eventsPackageBoundary,
  toolsPackageBoundary,
  mcpPackageBoundary,
  approvalsPackageBoundary,
  replayPackageBoundary,
  observabilityPackageBoundary,
  sdkPackageBoundary,
  cliPackageBoundary,
  templatesPackageBoundary,
] as const;

function findDuplicateBoundaryNames(names: readonly string[]): string[] {
  const counts = new Map<string, number>();

  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
    .sort();
}

export function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
  });

  app.register(cors, {
    origin: true,
  });

  app.get("/healthz", async () => ({
    status: "ok",
    project: projectMetadata.name,
    phase: projectMetadata.currentPhase,
  }));

  app.get("/manifest/project", async () => ({
    project: projectMetadata,
    commands: requiredQualityCommands,
  }));

  app.get("/manifest/packages", async () => ({
    packages: packageBoundaries,
    integrity: {
      duplicateNames: findDuplicateBoundaryNames(
        packageBoundaries.map((boundary) => boundary.name),
      ),
    },
  }));

  return app;
}
