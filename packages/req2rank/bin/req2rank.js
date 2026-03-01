#!/usr/bin/env node
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const entry = require.resolve("@req2rank/cli/dist/index.js");
const entryUrl = pathToFileURL(entry).href;

await import(entryUrl);
