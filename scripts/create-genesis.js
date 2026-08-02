import { writeFile as write, readFile as read } from 'fs/promises'
import { join } from 'path'
;(async () => {
  const { parseUnits } = await import('@leofcoin/utils')
  const { nodeConfig, createContractMessage } = await import('@leofcoin/lib')

  const createMessage = async (src, params = []) => {
    const contract = await read(src)
    const name = contract
      .toString()
      .match(/export{([A-Z])\w+|export { ([A-Z])\w+/g)[0]
      .replace(/export {|export{/, '')
    return createContractMessage(
      peernet.selectedAccount,
      new TextEncoder().encode(
        contract
          .toString()
          .replace(/export{([A-Z])\w+ as default}|export { ([A-Z])\w+ as default }/g, `return ${name}`)
          .replace(/\r?\n|\r/g, '')
      ),
      params
    )
  }
  // const Chain = require('./../chain/dist/chain');

  const Node = (await import('../packages/chain/exports/node.js')).default
  const args = process.argv.slice(2)
  const checkIdentity = args.includes('--check-identity')
  const password = process.env.GENESIS_PASSWORD || args.find((arg) => !arg.startsWith('--'))
  const node = new Node(
    {
      network: 'leofcoin:peach',
      networkVersion: 'peach',
      autoStart: false,
      root: process.env.LEOFCOIN_DATA_ROOT,
      freshIdentity: !checkIdentity
    },
    password
  )
  await node.ready
  if (checkIdentity) {
    console.log(`Identity loaded successfully: ${globalThis.peernet.selectedAccount}`)
    return
  }
  await globalThis.blockStore.clear()
  await globalThis.transactionPoolStore.clear()
  await globalThis.contractStore.clear()
  await globalThis.transactionStore.clear()
  await globalThis.accountsStore.clear()
  console.log(node)
  // console.log(peernet);
  // const chain = await new Chain()
  // console.log(chain);

  const nativeToken = await createMessage('./node_modules/@leofcoin/contracts/exports/native-token.js')
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
