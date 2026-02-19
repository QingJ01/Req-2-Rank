import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(rootDir, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: workspaceRoot
  }
};

export default nextConfig;
