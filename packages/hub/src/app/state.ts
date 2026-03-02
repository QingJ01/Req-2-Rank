import { SubmissionStore, ValidationHook, createSubmissionStore } from "../routes";
import { createEnvAuthValidator } from "../lib/auth";
import { createDrizzleSubmissionStore } from "../lib/db/client";
import { createDrizzleTokenStore } from "../lib/db/token-store";
import { ActorTokenStore, createMemoryTokenStore } from "../lib/token-store";

let _store: SubmissionStore | undefined;
let _validate: ValidationHook | undefined;
let _tokenStore: ActorTokenStore | undefined;

function createAppStore(): SubmissionStore {
  const databaseUrl = process.env.R2R_DATABASE_URL;
  if (databaseUrl) {
    return createDrizzleSubmissionStore(databaseUrl);
  }

  return createSubmissionStore();
}

function createAppTokenStore(): ActorTokenStore {
  const databaseUrl = process.env.R2R_DATABASE_URL;
  if (databaseUrl) {
    return createDrizzleTokenStore(databaseUrl);
  }
  return createMemoryTokenStore();
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

export const appTokenStore: ActorTokenStore = new Proxy({} as ActorTokenStore, {
  get(_target, prop, receiver) {
    if (!_tokenStore) {
      try {
        _tokenStore = createAppTokenStore();
      } catch {
        _tokenStore = createMemoryTokenStore();
      }
    }
    return Reflect.get(_tokenStore, prop, receiver);
  }
});

export const appValidate: ValidationHook = (...args: Parameters<ValidationHook>) => {
  if (!_validate) {
    _validate = createEnvAuthValidator(appTokenStore);
  }
  return _validate(...args);
};
