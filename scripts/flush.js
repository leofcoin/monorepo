import { unlink } from 'fs/promises'
import inquirer from 'inquirer'
import { nodeConfig } from '@leofcoin/lib'
import { glob } from 'fs/promises'

const Node = (await import('../packages/chain/exports/node.js')).default
const node = await new Node({ network: 'leofcoin:peach', networkVersion: 'peach' })
const config = await nodeConfig()

await globalThis.accountsStore.clear()
await globalThis.chainStore.clear()
await globalThis.blockStore.clear()
await globalThis.transactionStore.clear()
await globalThis.stateStore.clear()
await globalThis.transactionPoolStore.clear()

process.exit()
