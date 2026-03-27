export type DeliveryPhase = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface BoundaryDescriptor {
  readonly name: `@runroot/${string}`;
  readonly kind: "app" | "package";
  readonly phaseOwned: DeliveryPhase;
  readonly responsibility: string;
  readonly publicSurface: readonly string[];
}

export interface PackageBoundary extends BoundaryDescriptor {
  readonly kind: "package";
}

export interface AppBoundary extends BoundaryDescriptor {
  readonly kind: "app";
}

export const projectMetadata = {
  name: "Runroot",
  description:
    "MCP-native runtime and orchestration for durable developer and ops workflows.",
  currentPhase: 1,
  phaseName: "Scaffold / Foundations",
} as const;

export const requiredQualityCommands = [
  "pnpm install",
  "pnpm bootstrap",
  "pnpm lint",
  "pnpm typecheck",
  "pnpm test",
  "pnpm test:integration",
  "pnpm build",
] as const;
