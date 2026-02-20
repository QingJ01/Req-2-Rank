import { SubmissionStore, ValidationHook, createSubmissionStore } from "../routes.js";
import { createEnvAuthValidator } from "../lib/auth.js";
import { createDrizzleSubmissionStore } from "../lib/db/client.js";

let _store: SubmissionStore | undefined;
let _validate: ValidationHook | undefined;

function createAppStore(): SubmissionStore {
  const databaseUrl = process.env.R2R_DATABASE_URL;
  if (databaseUrl) {
    return createDrizzleSubmissionStore(databaseUrl);
  }

  return createSubmissionStore();
}

export const appStore: SubmissionStore = new Proxy({} as SubmissionStore, {
  get(_target, prop, receiver) {
    if (!_store) {
      try {
        _store = createAppStore();
      } catch {
        _store = createSubmissionStore();
      }
    }
    return Reflect.get(_store, prop, receiver);
  },
});

export const appValidate: ValidationHook = (...args: Parameters<ValidationHook>) => {
  if (!_validate) {
    _validate = createEnvAuthValidator();
  }
  return _validate(...args);
};
