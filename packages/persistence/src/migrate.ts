#!/usr/bin/env node

import {
  migratePostgresPersistence,
  migrateSqlitePersistence,
} from "./database-store";

async function main(argv: readonly string[]): Promise<void> {
  const driver = readFlag(argv, "driver");

  if (driver !== "postgres" && driver !== "sqlite") {
    throw new Error("Use --driver postgres or --driver sqlite.");
  }

  if (driver === "postgres") {
    const result = await migratePostgresPersistence({
      ...(process.env.DATABASE_URL
        ? { databaseUrl: process.env.DATABASE_URL }
        : {}),
    });

    writeResult(result);

    return;
  }

  const sqlitePath =
    process.env.RUNROOT_SQLITE_PATH ?? ".runroot/runroot.sqlite";
  const result = await migrateSqlitePersistence({
    filePath: sqlitePath,
  });

  writeResult(result);
}

function readFlag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);

  if (index === -1) {
    return undefined;
  }

  return argv[index + 1];
}

function writeResult(result: {
  readonly appliedVersions: readonly string[];
  readonly dialect: string;
  readonly location: string;
}): void {
  process.stdout.write(
    `${JSON.stringify(
      {
        appliedVersions: result.appliedVersions,
        dialect: result.dialect,
        location: result.location,
      },
      null,
      2,
    )}\n`,
  );
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  process.stderr.write(`${JSON.stringify({ error: message }, null, 2)}\n`);
  process.exitCode = 1;
});
