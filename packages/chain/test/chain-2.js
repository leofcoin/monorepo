import { signTransaction } from '@leofcoin/lib'
import networks from '@leofcoin/networks'
import { setTargets } from '@vandeurenglenn/debug'

setTargets(true)

import { readFile } from 'fs/promises'
import { formatUnits, parseUnits } from '../../utils/exports/utils.js'
let password
try {
  password = (await readFile('./.password.txt')).toString()
} catch (error) {
  console.log(error)
}

const Chain = await import('../exports/chain.js')
const Node = await import('../exports/node.js')

const node = new Node.default(
  {
    network: 'leofcoin:peach',
    networkName: 'leofcoin:peach',
    networkVersion: 'peach',
    version: '0.1.1',
    prefix: './.test-chain-root',
    stars: networks.leofcoin.peach.stars,
    autoStart: false,
    password
  },
  password
)
await node.ready

console.log(await contractStore.get('IHNY2GQHYDJD5VP7HY5DY62A3GGX37TF3L6XYEHW6CIKLGLWBLUK7S3L2UG'))
console.log(peernet)
console.log(peernet.stores)
console.time('load chain')

const chain = new Chain.default({
  password,
  prefix: './.test-chain-root'
})

await chain.ready
console.log(chain.ready)
