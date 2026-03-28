import { resolve } from "node:path";

export type DeliveryPhase = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type ExecutionMode = "inline" | "queued";

export type PersistenceDriver = "file" | "postgres" | "sqlite";

export interface ResolveExecutionModeOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly executionMode?: ExecutionMode;
}

export interface ResolvePersistenceConfigOptions {
  readonly databaseUrl?: string;
  readonly driver?: PersistenceDriver;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly sqlitePath?: string;
  readonly workspacePath?: string;
}

export interface ResolvedPersistenceConfig {
  readonly databaseUrl?: string;
  readonly driver: PersistenceDriver;
  readonly location: string;
  readonly sqlitePath?: string;
  readonly workspacePath?: string;
}

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
  currentPhase: 10,
  phaseName: "Persisted Tool History and Execution Telemetry",
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

export function resolveWorkspacePath(
  workspacePath?: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return resolve(
    workspacePath ?? env.RUNROOT_WORKSPACE_PATH ?? ".runroot/workspace.json",
  );
}

export function resolveSqlitePath(
  sqlitePath?: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return resolve(
    sqlitePath ?? env.RUNROOT_SQLITE_PATH ?? ".runroot/runroot.sqlite",
  );
}

export function resolvePersistenceConfig(
  options: ResolvePersistenceConfigOptions = {},
): ResolvedPersistenceConfig {
  const env = options.env ?? process.env;
  const explicitDriver = options.driver;
  const envDriver = readPersistenceDriver(env.RUNROOT_PERSISTENCE_DRIVER);
  const workspacePath = options.workspacePath ?? env.RUNROOT_WORKSPACE_PATH;
  const databaseUrl = options.databaseUrl ?? env.DATABASE_URL;
  const sqlitePath = options.sqlitePath ?? env.RUNROOT_SQLITE_PATH;

  if (explicitDriver) {
    return resolvePersistenceConfigForDriver(
      explicitDriver,
      env,
      databaseUrl,
      sqlitePath,
      workspacePath,
    );
  }

  if (envDriver) {
    return resolvePersistenceConfigForDriver(
      envDriver,
      env,
      databaseUrl,
      sqlitePath,
      workspacePath,
    );
  }

  if (workspacePath) {
    const resolvedWorkspacePath = resolveWorkspacePath(workspacePath, env);

    return {
      driver: "file",
      location: resolvedWorkspacePath,
      workspacePath: resolvedWorkspacePath,
    };
  }

  if (databaseUrl) {
    return {
      databaseUrl,
      driver: "postgres",
      location: databaseUrl,
    };
  }

  const resolvedSqlitePath = resolveSqlitePath(sqlitePath, env);

  return {
    driver: "sqlite",
    location: resolvedSqlitePath,
    sqlitePath: resolvedSqlitePath,
  };
}

function readPersistenceDriver(
  value: string | undefined,
): PersistenceDriver | undefined {
  if (value === "file" || value === "postgres" || value === "sqlite") {
    return value;
  }

  return undefined;
}

export function resolveExecutionMode(
  options: ResolveExecutionModeOptions = {},
): ExecutionMode {
  if (options.executionMode) {
    return options.executionMode;
  }

  const env = options.env ?? process.env;
  const envMode = readExecutionMode(env.RUNROOT_EXECUTION_MODE);

  return envMode ?? "inline";
}

function resolvePersistenceConfigForDriver(
  driver: PersistenceDriver,
  env: Readonly<Record<string, string | undefined>>,
  databaseUrl: string | undefined,
  sqlitePath: string | undefined,
  workspacePath: string | undefined,
): ResolvedPersistenceConfig {
  switch (driver) {
    case "file": {
      const resolvedWorkspacePath = resolveWorkspacePath(workspacePath, env);

      return {
        driver,
        location: resolvedWorkspacePath,
        workspacePath: resolvedWorkspacePath,
      };
    }
    case "postgres": {
      if (!databaseUrl) {
        throw new Error(
          'Postgres persistence requires DATABASE_URL or an explicit "databaseUrl" option.',
        );
      }

      return {
        databaseUrl,
        driver,
        location: databaseUrl,
      };
    }
    case "sqlite": {
      const resolvedSqlitePath = resolveSqlitePath(sqlitePath, env);

      return {
        driver,
        location: resolvedSqlitePath,
        sqlitePath: resolvedSqlitePath,
      };
    }
  }
}

function readExecutionMode(
  value: string | undefined,
): ExecutionMode | undefined {
  if (value === "inline" || value === "queued") {
    return value;
  }

  return undefined;
}
