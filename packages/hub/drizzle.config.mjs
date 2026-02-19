import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.R2R_DATABASE_URL || "postgres://user:password@localhost:5432/req2rank"
  }
});
