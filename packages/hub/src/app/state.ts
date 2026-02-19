import { SubmissionStore, ValidationHook, createSubmissionStore } from "../routes.js";
import { createEnvAuthValidator } from "../lib/auth.js";
import { createDrizzleSubmissionStore } from "../lib/db/client.js";

function createAppStore(): SubmissionStore {
  const databaseUrl = process.env.R2R_DATABASE_URL;
  if (databaseUrl) {
    return createDrizzleSubmissionStore(databaseUrl);
  }

  return createSubmissionStore();
}

export const appStore: SubmissionStore = createAppStore();
export const appValidate: ValidationHook = createEnvAuthValidator();
