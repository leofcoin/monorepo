import { writeFile as write, readFile as read } from 'fs/promises'
import { join } from 'path'
import { clearGenesisState } from './genesis-state.js'
import { parseGenesisAllocations, validateGenesisSupply } from './genesis-allocations.js'
import { prepareGenesisContractSource } from './genesis-contract-source.js'
import { prepareGenesisCredentials, writeGenesisIdentityBackup } from './genesis-credentials.js'
;(async () => {
  const { parseUnits } = await import('@leofcoin/utils')
  const { nodeConfig, createContractMessage } = await import('@leofcoin/lib')

  const createMessage = async (src, params = []) => {
    const contract = await read(src)
    return createContractMessage(
      peernet.selectedAccount,
      new TextEncoder().encode(prepareGenesisContractSource(contract)),
      params
    )
  }
  // const Chain = require('./../chain/dist/chain');

  const Node = (await import('../packages/chain/exports/node.js')).default
  const args = process.argv.slice(2)
  const checkIdentity = args.includes('--check-identity')
  const reuseIdentity = args.includes('--reuse-identity')
  const suppliedPassword = process.env.GENESIS_PASSWORD || args.find((arg) => !arg.startsWith('--'))
  const targetSupply = process.env.LFC_TARGET_SUPPLY
  const initialSupply = process.env.LFC_INITIAL_SUPPLY
  if (!checkIdentity && (!targetSupply || !initialSupply)) {
    throw new Error('LFC_TARGET_SUPPLY and LFC_INITIAL_SUPPLY are required as whole LFC amounts')
  }
  let credentials
  let password = suppliedPassword
  if (!checkIdentity) {
    if (reuseIdentity && !password) {
      throw new Error('GENESIS_PASSWORD is required with --reuse-identity')
    }
    credentials = await prepareGenesisCredentials({
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
  const exportedIdentity = await globalThis.peernet.identity.export(password)
  await writeGenesisIdentityBackup({
    identity: exportedIdentity,
    account: globalThis.peernet.selectedAccount,
    paths: credentials.paths
  })
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
  await clearGenesisState()
  console.log(node)
  // console.log(peernet);
  // const chain = await new Chain()
  // console.log(chain);

  const nativeToken = await createMessage('./node_modules/@leofcoin/contracts/exports/native-token.js', [
    supply.target,
    supply.initial,
    allocations
  ])
  if (!(await contractStore.has(await nativeToken.hash()))) {
    await contractStore.put(await nativeToken.hash(), nativeToken.encoded)
  }

  const factory = await createMessage('./node_modules/@leofcoin/contracts/exports/factory.js', [
    await nativeToken.hash(),
    parseUnits('1000').toString()
  ])

  if (!(await contractStore.has(await factory.hash()))) {
    await contractStore.put(await factory.hash(), factory.encoded)
  }

  const validators = await createMessage('./node_modules/@leofcoin/contracts/exports/validators.js', [
    await nativeToken.hash()
  ])

  if (!(await contractStore.has(await validators.hash()))) {
    await contractStore.put(await validators.hash(), validators.encoded)
  }

  const nameService = await createMessage('./node_modules/@leofcoin/contracts/exports/name-service.js', [
    await factory.hash(),
    await nativeToken.hash(),
    await validators.hash(),
    parseUnits('1000').toString()
  ])

  if (!(await contractStore.has(await nameService.hash()))) {
    await contractStore.put(await nameService.hash(), nameService.encoded)
  }

  const addresses = {
    contractFactory: await factory.hash(),
    nativeToken: await nativeToken.hash(),
    nameService: await nameService.hash(),
    validators: await validators.hash()
  }

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
