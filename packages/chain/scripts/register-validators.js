import { readFile } from 'fs/promises'

const Chain = (await import('../exports/chain.js')).default
const Node = (await import('../exports/node.js')).default

// Parse CLI args
const args = process.argv.slice(2)
const countArg = args.find((a) => a.startsWith('--count='))
const delayArg = args.find((a) => a.startsWith('--delay='))
const count = countArg ? parseInt(countArg.split('=')[1]) : 3
const delayMs = delayArg ? parseInt(delayArg.split('=')[1]) : 1000

let password
try {
  password = (await readFile('./.password.txt')).toString().trim()
} catch (error) {
  password = null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function registerValidator(index) {
  const nodePassword = password ? `${password}-validator-${index}` : `dev-validator-${index}`
  const storeNamespace = `validator-${index}`

  try {
    console.log(`[${index}] Creating node...`)
    const node = new Node(
      {
        network: 'leofcoin:peach',
        networkName: 'leofcoin:peach',
        networkVersion: 'peach',
        version: '0.1.1',
        autoStart: false,
        password: nodePassword,
        root: storeNamespace,
        name: `.${storeNamespace}`
      },
      nodePassword
    )

    // Reduce node init timeout
    const nodeReady = Promise.race([
      node.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Node init timeout')), 10000))
    ])

    await nodeReady
    console.log(`[${index}] Node ready`)

    // Create chain with same namespace
    console.log(`[${index}] Creating chain...`)
    const chain = new Chain({
      password: nodePassword,
      storeNamespace
    })

    const chainReady = Promise.race([
      chain.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Chain init timeout')), 15000))
    ])

    await chainReady
    console.log(`[${index}] Chain ready`)

    // Register as validator
    console.log(`[${index}] Registering as validator...`)
    const account = globalThis.peernet?.selectedAccount
    if (!account) {
      console.warn(`[${index}] No peernet account available`)
      return
    }

    await chain.participate(account)
    console.log(`[${index}] ✅ Registered`)
  } catch (err) {
    console.error(`[${index}] Error:`, err?.message || err)
  }
}

// Register validators sequentially with delay
console.log(`Registering ${count} validators with ${delayMs}ms delay between each...`)
for (let i = 0; i < count; i++) {
  if (i > 0) await sleep(delayMs)
  await registerValidator(i)
}

console.log('✅ All validators registered')
