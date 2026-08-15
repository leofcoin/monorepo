import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const run = promisify(execFile)
const action = process.argv[2] || 'staging'
const allowedActions = new Set(['start', 'stop', 'restart', 'status', 'smoke', 'staging'])
if (!allowedActions.has(action)) throw new Error(`unsupported action: ${action}`)

const configPath = process.env.LEOFCOIN_REMOTE_CONFIG
if (!configPath) throw new Error('set LEOFCOIN_REMOTE_CONFIG to a remote-nodes JSON file')
const config = JSON.parse(await readFile(configPath, 'utf8'))
if (!Array.isArray(config.nodes) || config.nodes.length === 0) throw new Error('remote config has no nodes')

const validate = (value, label) => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.@:-]+$/.test(value)) throw new Error(`invalid ${label}`)
  return value
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const ssh = async (node, command) => {
  const host = validate(node.host, `${node.name || 'node'} host`)
  const { stdout, stderr } = await run(
    'ssh',
    ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, command],
    { timeout: config.timeoutMs || 30_000, maxBuffer: 1024 * 1024 }
  )
  return { stdout: stdout.trim(), stderr: stderr.trim() }
}

const serviceCommand = (node, verb) => {
  const service = validate(node.service || 'leofcoin', `${node.name || 'node'} service`)
  return `systemctl --user ${verb} ${service}`
}

const waitUntilReady = async (node) => {
  const attempts = config.readinessAttempts || 30
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await ssh(node, serviceCommand(node, 'is-active'))
      if (node.healthCommand) await ssh(node, node.healthCommand)
      return
    } catch (error) {
      if (attempt === attempts) throw error
      await delay(config.pollIntervalMs || 2_000)
    }
  }
}

const changeState = async (node, verb) => {
  process.stdout.write(`${verb} ${node.name || node.host}\n`)
  await ssh(node, serviceCommand(node, verb))
  if (verb !== 'stop') await waitUntilReady(node)
}

const parseTip = (node, output) => {
  const line = output.split('\n').filter(Boolean).at(-1)
  let value
  try {
    value = JSON.parse(line)
  } catch {
    throw new Error(`${node.name || node.host} stateCommand must end with JSON`)
  }
  const tip = value.lastBlock || value.tip || value
  const index = Number(tip.index)
  if (typeof tip.hash !== 'string' || !tip.hash || !Number.isSafeInteger(index) || index < -1) {
    throw new Error(`${node.name || node.host} returned an invalid canonical tip`)
  }
  return { hash: tip.hash, index }
}

const readTip = async (node) => {
  if (!node.stateCommand) throw new Error(`${node.name || node.host} is missing stateCommand`)
  const { stdout } = await ssh(node, node.stateCommand)
  return parseTip(node, stdout)
}

const tipsMatch = (tips) => tips.every(({ tip }) => tip.hash === tips[0].tip.hash && tip.index === tips[0].tip.index)

const waitForConvergence = async (nodes, minimumIndex = -1) => {
  const attempts = config.convergenceAttempts || 60
  let latest = []
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    latest = await Promise.all(nodes.map(async (node) => ({ node, tip: await readTip(node) })))
    if (tipsMatch(latest) && latest[0].tip.index >= minimumIndex) {
      const tip = latest[0].tip
      process.stdout.write(`converged at block ${tip.index} ${tip.hash}\n`)
      return tip
    }
    await delay(config.pollIntervalMs || 2_000)
  }
  const summary = latest.map(({ node, tip }) => `${node.name || node.host}=${tip.index}:${tip.hash}`).join(', ')
  throw new Error(`nodes did not converge at or above block ${minimumIndex}: ${summary}`)
}

const submitTransaction = async (node) => {
  if (!node.transactionCommand) throw new Error(`${node.name || node.host} is missing transactionCommand`)
  process.stdout.write(`submit transaction through ${node.name || node.host}\n`)
  await ssh(node, node.transactionCommand)
}

const runStagingGate = async () => {
  const minimumNodes = config.minimumNodes || 3
  if (config.nodes.length < minimumNodes) {
    throw new Error(`staging requires at least ${minimumNodes} nodes, received ${config.nodes.length}`)
  }

  await Promise.all(config.nodes.map((node) => waitUntilReady(node)))
  const initial = await waitForConvergence(config.nodes)

  const lateNode = config.nodes.at(-1)
  const onlineNodes = config.nodes.slice(0, -1)
  await changeState(lateNode, 'stop')
  try {
    await submitTransaction(onlineNodes[0])
    const advanced = await waitForConvergence(onlineNodes, initial.index + 1)
    await changeState(lateNode, 'start')
    await waitForConvergence(config.nodes, advanced.index)
  } catch (error) {
    await changeState(lateNode, 'start').catch(() => {})
    throw error
  }

  for (const node of config.nodes) {
    const before = await waitForConvergence(config.nodes)
    await changeState(node, 'restart')
    await waitForConvergence(config.nodes, before.index)
  }
}

if (action === 'status') {
  await Promise.all(config.nodes.map((node) => waitUntilReady(node)))
  if (config.nodes.every((node) => node.stateCommand)) await waitForConvergence(config.nodes)
} else if (action === 'smoke') {
  await Promise.all(config.nodes.map((node) => waitUntilReady(node)))
  await changeState(config.nodes[0], 'restart')
  await Promise.all(config.nodes.map((node) => waitUntilReady(node)))
  if (config.nodes.every((node) => node.stateCommand)) await waitForConvergence(config.nodes)
} else if (action === 'staging') {
  await runStagingGate()
} else {
  await Promise.all(config.nodes.map((node) => changeState(node, action)))
}

process.stdout.write(`remote ${action} completed for ${config.nodes.length} nodes\n`)
