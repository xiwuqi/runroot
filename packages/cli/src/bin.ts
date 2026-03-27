#!/usr/bin/env node

import { runCli } from "./index";

runCli(process.argv.slice(2)).then((exitCode) => {
  process.exitCode = exitCode;
});
