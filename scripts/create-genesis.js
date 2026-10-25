import { writeFile as write, readFile as read } from 'fs/promises'
import { join } from 'path'
import { clearGenesisState } from './genesis-state.js'
import { parseGenesisAllocations, validateGenesisSupply } from './genesis-allocations.js'
import { prepareGenesisContractSource } from './genesis-contract-source.js'
import {
  genesisCredentialPaths,
  prepareGenesisCredentials,
  writeGenesisIdentityBackup
} from './genesis-credentials.js'
;(async () => {
  const { parseUnits } = await import('@leofcoin/utils')
  const { buildGenesisContracts } = await import('@leofcoin/lib/genesis-plan')
  const { createChainIdentity } = await import('@leofcoin/lib/chain-identity')
  // const Chain = require('./../chain/dist/chain');

  const Node = (await import('../packages/chain/exports/node.js')).default
  const args = process.argv.slice(2)
  const checkIdentity = args.includes('--check-identity')
  const reuseIdentity = args.includes('--reuse-identity')
  const suppliedPassword = process.env.GENESIS_PASSWORD || args.find((arg) => !arg.startsWith('--'))
  const passwordFile = process.env.GENESIS_PASSWORD_FILE
  const targetSupply = process.env.LFC_TARGET_SUPPLY
  const initialSupply = process.env.LFC_INITIAL_SUPPLY
  if (!checkIdentity && (!targetSupply || !initialSupply)) {
    throw new Error('LFC_TARGET_SUPPLY and LFC_INITIAL_SUPPLY are required as whole LFC amounts')
  }
  let credentials
  let password = passwordFile ? (await read(passwordFile, 'utf8')).trim() : suppliedPassword
  if (passwordFile && !password) throw new Error(`empty genesis password file: ${passwordFile}`)
  if (!checkIdentity) {
    if (reuseIdentity && !password) {
      throw new Error('GENESIS_PASSWORD is required with --reuse-identity')
    }
    credentials = reuseIdentity
      ? {
          password,
          paths: genesisCredentialPaths(process.env.LFC_GENESIS_CREDENTIALS_DIR)
        }
      : await prepareGenesisCredentials({
          directory: process.env.LFC_GENESIS_CREDENTIALS_DIR,
          password
        })
    password = credentials.password
  }
  const node = new Node(
    {
      network: 'leofcoin:peach',
      networkVersion: 'peach',
      autoStart: false,
      root: process.env.LEOFCOIN_DATA_ROOT,
      freshIdentity: !checkIdentity && !reuseIdentity
    },
    password
  )
  await node.ready
  if (checkIdentity) {
    console.log(`Identity loaded successfully: ${globalThis.peernet.selectedAccount}`)
    return
  }
  if (!reuseIdentity) {
    const exportedIdentity = await globalThis.peernet.identity.export(password)
    await writeGenesisIdentityBackup({
      identity: exportedIdentity,
      account: globalThis.peernet.selectedAccount,
      paths: credentials.paths
    })
  }
  const allocationConfig =
    process.env.LFC_GENESIS_ALLOCATIONS ||
    JSON.stringify([{ address: globalThis.peernet.selectedAccount, amount: initialSupply }])
  const allocations = parseGenesisAllocations(allocationConfig, parseUnits)
  const supply = validateGenesisSupply(targetSupply, initialSupply, allocations, parseUnits)
  console.log(`Genesis account: ${globalThis.peernet.selectedAccount}`)
  console.log(`Initial allocation: ${initialSupply} LFC`)
  console.log(`Genesis password: ${credentials.paths.password}`)
  console.log(`Encrypted identity backup: ${credentials.paths.identity}`)
  console.log('Copy the complete credentials directory to encrypted offline storage.')
  const sources = {}
  for (const [name, filename] of Object.entries({
    nativeToken: 'native-token.js', contractFactory: 'factory.js', validators: 'validators.js', nameService: 'name-service.js'
  })) {
    sources[name] = new TextEncoder().encode(prepareGenesisContractSource(
      await read(join('node_modules/@leofcoin/contracts/exports', filename))
    ))
  }
  const { messages, contracts: addresses } = await buildGenesisContracts(
    globalThis.peernet.selectedAccount, supply.target, supply.initial, allocations, sources
  )
  const identity = await createChainIdentity('leofcoin:peach', addresses)
  console.log('Chain ID:', identity.chainId)
  // Build and hash everything before the explicitly requested reset.
  await clearGenesisState()
  for (const message of Object.values(messages)) await contractStore.put(await message.hash(), message.encoded)
  const { nativeToken, contractFactory: factory, validators, nameService } = messages
  console.log({ addresses })

  const bytecodes = {
    contractFactory: await factory.toString(),
    nativeToken: await nativeToken.toString(),
    nameService: await nameService.toString(),
    validators: await validators.toString()
  }
  await write(join(process.cwd(), 'packages/addresses/src/addresses.json'), JSON.stringify(addresses, null, '\t'))
  await write(join(process.cwd(), 'packages/lib/src/bytecodes.json'), JSON.stringify(bytecodes, null, '\t'))
  console.log('done')
})()
