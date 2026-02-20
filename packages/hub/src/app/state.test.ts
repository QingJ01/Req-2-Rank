import { afterEach, describe, expect, it, vi } from "vitest";

describe("app state store initialization", () => {
  const originalDatabaseUrl = process.env.R2R_DATABASE_URL;

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.doUnmock("../lib/db/client.js");
    if (originalDatabaseUrl === undefined) {
      delete process.env.R2R_DATABASE_URL;
    } else {
      process.env.R2R_DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("falls back to in-memory store when drizzle initialization throws", async () => {
    process.env.R2R_DATABASE_URL = "postgres://broken";

    vi.doMock("../lib/db/client.js", () => ({
      createDrizzleSubmissionStore: vi.fn(() => {
        throw new Error("db init failed");
      })
    }));

    const { appStore } = await import("./state.js");
    const nonce = await appStore.issueNonce("actor-1");

    expect(nonce.nonce).toContain("nonce-");
  });

  it("does not initialize drizzle store when database url is absent", async () => {
    delete process.env.R2R_DATABASE_URL;
    const createDrizzleSubmissionStore = vi.fn();

    vi.doMock("../lib/db/client.js", () => ({
      createDrizzleSubmissionStore
    }));

    const { appStore } = await import("./state.js");
    await appStore.issueNonce("actor-2");

    expect(createDrizzleSubmissionStore).not.toHaveBeenCalled();
  });
});
