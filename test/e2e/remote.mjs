import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const run = promisify(execFile)
const action = process.argv[2] || 'smoke'
const allowedActions = new Set(['start', 'stop', 'restart', 'status', 'smoke'])
if (!allowedActions.has(action)) throw new Error(`unsupported action: ${action}`)

const configPath = process.env.LEOFCOIN_REMOTE_CONFIG
if (!configPath) throw new Error('set LEOFCOIN_REMOTE_CONFIG to a remote-nodes JSON file')
const config = JSON.parse(await readFile(configPath, 'utf8'))
if (!Array.isArray(config.nodes) || config.nodes.length === 0) throw new Error('remote config has no nodes')

const validate = (value, label) => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.@:-]+$/.test(value)) throw new Error(`invalid ${label}`)
  return value
}

const ssh = async (node, command) => {
  const host = validate(node.host, `${node.name || 'node'} host`)
  const { stdout, stderr } = await run(
    'ssh',
    ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, command],
    { timeout: config.timeoutMs || 30_000 }
  )
  return { stdout: stdout.trim(), stderr: stderr.trim() }
}

const serviceCommand = (node, verb) => {
  const service = validate(node.service || 'leofcoin', `${node.name || 'node'} service`)
  return `systemctl --user ${verb} ${service}`
}

const waitUntilReady = async (node) => {
  const attempts = config.readinessAttempts || 12
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await ssh(node, serviceCommand(node, 'is-active'))
      if (node.healthCommand) await ssh(node, node.healthCommand)
      return
    } catch (error) {
      if (attempt === attempts) throw error
      await new Promise((resolve) => setTimeout(resolve, 2_000))
    }
  }
}

const changeState = async (node, verb) => {
  process.stdout.write(`${verb} ${node.name || node.host}\n`)
  await ssh(node, serviceCommand(node, verb))
  if (verb !== 'stop') await waitUntilReady(node)
}

if (action === 'status') {
  await Promise.all(config.nodes.map((node) => waitUntilReady(node)))
} else if (action === 'smoke') {
  await Promise.all(config.nodes.map((node) => waitUntilReady(node)))
  await changeState(config.nodes[0], 'restart')
  await Promise.all(config.nodes.map((node) => waitUntilReady(node)))
} else {
  await Promise.all(config.nodes.map((node) => changeState(node, action)))
}

process.stdout.write(`remote ${action} completed for ${config.nodes.length} nodes\n`)
