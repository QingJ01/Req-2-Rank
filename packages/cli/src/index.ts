#!/usr/bin/env node
import { createCliApp } from "./app.js";

const app = createCliApp();
app
  .run(process.argv.slice(2))
  .then((output) => {
    if (output.length > 0) {
      process.stdout.write(`${output}\n`);
    }
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
