import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export async function runMigrations(): Promise<void> {
  const databaseUrl = resolveDatabaseUrlForMigrations();

  const client = postgres(databaseUrl, { max: 1 });
  try {
    const db = drizzle(client);
    await migrate(db, {
      migrationsFolder: resolve(process.cwd(), "drizzle")
    });
  } finally {
    await client.end({ timeout: 5 });
  }
}

function loadEnvFileIfPresent(cwd: string, env: NodeJS.ProcessEnv): void {
  const envPath = resolve(cwd, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf-8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const delimiterIndex = line.indexOf("=");
    if (delimiterIndex <= 0) {
      continue;
    }

    const key = line.slice(0, delimiterIndex).trim();
    let value = line.slice(delimiterIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!env[key]) {
      env[key] = value;
    }
  }
}

export function resolveDatabaseUrlForMigrations(options?: { cwd?: string; env?: NodeJS.ProcessEnv }): string {
  const cwd = options?.cwd ?? process.cwd();
  const env = options?.env ?? process.env;

  if (!env.R2R_DATABASE_URL) {
    loadEnvFileIfPresent(cwd, env);
  }

  const databaseUrl = env.R2R_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("R2R_DATABASE_URL is required for migrations");
  }

  return databaseUrl;
}

const isDirectExecution = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;

if (isDirectExecution) {
  runMigrations()
    .then(() => {
      process.stdout.write("Hub migrations applied.\n");
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
