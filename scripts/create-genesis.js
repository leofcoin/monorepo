import { writeFile as write, readFile as read } from 'fs/promises'
import { join } from 'path'
(async () => {
  const {parseUnits} = await import('./../utils/src/utils.js')
  const {nodeConfig, createContractMessage} = await import('./../lib/exports/index.js')
  
  const createMessage = async (src, params = []) => {
    const contract = await read(src)
    const name = contract.toString().match(/export{([A-Z])\w+|export { ([A-Z])\w+/g)[0].replace(/export {|export{/, '')
    return createContractMessage(peernet.selectedAccount, new TextEncoder().encode(contract.toString().replace(/export{([A-Z])\w+ as default}/g, `return ${name}`).replace(/\r?\n|\r/g, '')), params)
  }
  // const Chain = require('./../chain/dist/chain');
  
  const Node = (await import('./../chain/exports/node.js')).default;
  const node = await new Node({network: 'leofcoin:peach', networkVersion: 'peach'})
  await nodeConfig()
  console.log(peernet.selectedAccount);
  // const chain = await new Chain()
  // console.log(chain);
  const factory = await createMessage('./scripts/node_modules/@leofcoin/contracts/exports/factory.js')
console.log(factory);
  if (!await contractStore.has(await factory.hash())) {
    await contractStore.put(await factory.hash(), factory.encoded)
  }

  const nativeToken = await createMessage('./scripts/node_modules/@leofcoin/contracts/exports/native-token.js')
  if (!await contractStore.has(await nativeToken.hash())) {
    await contractStore.put(await nativeToken.hash(), nativeToken.encoded)
  }


  const validators = await createMessage('./scripts/node_modules/@leofcoin/contracts/exports/validators.js', [await nativeToken.hash()])

  if (!await contractStore.has(await validators.hash())) {
    await contractStore.put(await validators.hash(), validators.encoded)
  }


  const nameService = await createMessage('./scripts/node_modules/@leofcoin/contracts/exports/name-service.js', [await factory.hash(), await nativeToken.hash(), await validators.hash(), parseUnits('1000').toString()])

  if (!await contractStore.has(await nameService.hash())) {
    await contractStore.put(await nameService.hash(), nameService.encoded)
  }

  const addresses = {
    contractFactory: await factory.hash(),
    nativeToken: await nativeToken.hash(),
    nameService: await nameService.hash(),
    validators: await validators.hash()
  }

console.log({addresses});

  const bytecodes = {
    contractFactory: await factory.toString(),
    nativeToken: await nativeToken.toString(),
    nameService: await nameService.toString(),
    validators: await validators.toString()
  }
console.log(await factory.toBs32());
  await write(join(process.cwd(), './addresses/src/addresses.json'), JSON.stringify(addresses, null, '\t'))
  await write(join(process.cwd(), './lib/src/bytecodes.json'), JSON.stringify(bytecodes, null, '\t'))
  console.log('done');
})()
