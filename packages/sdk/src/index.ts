import type { PackageBoundary } from "@runroot/config";

export const sdkPackageBoundary = {
  name: "@runroot/sdk",
  kind: "package",
  phaseOwned: 5,
  responsibility:
    "Programmatic client APIs for interacting with Runroot services.",
  publicSurface: ["client SDK", "typed request models", "helper utilities"],
} as const satisfies PackageBoundary;
