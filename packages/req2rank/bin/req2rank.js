#!/usr/bin/env node
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const entry = require.resolve("@req2rank/cli/dist/index.js");

await import(entry);
