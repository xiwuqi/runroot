import type { PackageBoundary } from "@runroot/config";

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
