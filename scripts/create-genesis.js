

(async () => {
  const {promisify} = require('util')
  const read = promisify(require('fs').readFile)
  const write = promisify(require('fs').writeFile)
  const {parseUnits} = require('./../utils/dist/utils')
  const {nodeConfig, createContractMessage} = require('./../lib/dist/lib')
  const {join} = require('path')
  
  const createMessage = async (src, params = []) => {
    const contract = await read(src)
    return createContractMessage(peernet.id, `return ${contract.toString().replace(/export{([A-Z])\w+ as default}/g, '')}`, params)
  }
  // const Chain = require('./../chain/dist/chain');
  
  const Node = require('./../chain/dist/node');
  const node = await new Node()
  await nodeConfig()
  console.log(peernet.id);
  // const chain = await new Chain()
  // console.log(chain);
  const factory = await createMessage('./chain/dist/contracts/factory.js')
console.log(factory);
  if (!await contractStore.has(await factory.hash)) {
    await contractStore.put(await factory.hash, factory.encoded)
  }

  const nativeToken = await createMessage('./chain/dist/contracts/nativeToken.js')
  if (!await contractStore.has(await nativeToken.hash)) {
    await contractStore.put(await nativeToken.hash, nativeToken.encoded)
  }


  const validators = await createMessage('./chain/dist/contracts/validators.js', [await nativeToken.hash])

  if (!await contractStore.has(await validators.hash)) {
    await contractStore.put(await validators.hash, validators.encoded)
  }


  const nameService = await createMessage('./chain/dist/contracts/nameService.js', [await factory.hash, await nativeToken.hash, await validators.hash, parseUnits('1000').toString()])

  if (!await contractStore.has(await nameService.hash)) {
    await contractStore.put(await nameService.hash, nameService.encoded)
  }

  const addresses = {
    contractFactory: await factory.hash,
    nativeToken: await nativeToken.hash,
    nameService: await nameService.hash,
    validators: await validators.hash
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
