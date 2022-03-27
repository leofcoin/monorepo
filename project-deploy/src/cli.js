#!/usr/bin/env node
import { getConfig } from './tasks/tasks.js'
import { getLogger } from './utils.js'
import deploy from './project-deploy.js';

(async () => {
  let network

  for (const arg of process.argv) {
    if (arg === '--network') network = argv[argv.indexOf(arg) + 1]
  }
  const config = await getConfig()
  if (!config.deploy) return console.log(`no config file found, ensure you have a project-deploy.config.json in your project directory`);
  if (!network) network = config.defaultNetwork

  for (const deployment of Object.keys(config.deploy)) {

    try {
      await deploy(deployment, config.deploy[deployment], network)
    } catch (e) {
      getLogger().fail(e.message)
    }
  }
})()
