import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { AdminAccount } from "@music-city/shared";

import { databaseService } from "../services/database.service.js";
import { passwordService } from "../services/password.service.js";

const workspaceEnvPath = resolve(process.cwd(), "..", ".env");
const localEnvPath = resolve(process.cwd(), ".env");

if (existsSync(localEnvPath)) {
  loadEnv({ path: localEnvPath });
} else if (existsSync(workspaceEnvPath)) {
  loadEnv({ path: workspaceEnvPath });
} else {
  loadEnv();
}

type PersistedAdminAccount = AdminAccount & {
  passwordHash: string;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = new Map<string, string>();

  for (let index = 0; index < args.length; index += 1) {
    const part = args[index];

    if (!part.startsWith("--")) {
      continue;
    }

    const key = part.slice(2);
    const value = args[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    options.set(key, value);
    index += 1;
  }

  const email = options.get("email")?.trim().toLowerCase();
  const password = options.get("password");

  if (!email) {
    throw new Error("Missing required --email argument");
  }

  if (!password || password.length < 8) {
    throw new Error("Missing required --password argument with at least 8 characters");
  }

  return { email, password };
};

const main = async () => {
  const { email, password } = parseArgs();
  const existing =
    await databaseService.findAdminByEmail<PersistedAdminAccount>(email);

  if (!existing) {
    throw new Error(`No admin account found for ${email}`);
  }

  const updated: PersistedAdminAccount = {
    ...existing,
    email,
    passwordHash: await passwordService.hashPassword(password),
    updatedAt: new Date().toISOString(),
  };

  await databaseService.upsertAdmin(updated.id, updated.email, updated.role, updated);

  console.log(`Updated admin password for ${updated.email}`);
};

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}).finally(async () => {
  await databaseService.close();
});
