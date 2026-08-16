#!/usr/bin/env node

import { runCli } from './cli.js'

runCli(['validator', ...process.argv.slice(2)]).catch((error) => {
  process.stderr.write(`leofcoin-validator: ${(error as Error)?.message ?? error}\n`)
  process.exitCode = 1
})
