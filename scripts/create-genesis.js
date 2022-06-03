

(async () => {
  const {promisify} = require('util')
  const read = promisify(require('fs').readFile)
  const write = promisify(require('fs').writeFile)
  const {join} = require('path')
  const createMessage = async (src, params = []) => {
    const contract = await read(src)
    return chain.createContractMessage(peernet.id, new TextEncoder().encode(`return ${contract.toString().replace(/export{([A-Z])\w+ as default}/g, '')}`), params)
  }
  const Chain = require('./chain/dist/chain');
  const Node = require('./chain/dist/node');
  const node = await new Node()
  const chain = await new Chain()
  const factory = await createMessage('./chain/dist/contracts/factory.js')

  if (!await contractStore.has(factory.hash)) {
    await contractStore.put(factory.hash, factory.encoded)
  }

  const nativeToken = await createMessage('./chain/dist/contracts/nativeToken.js')
  if (!await contractStore.has(nativeToken.hash)) {
    await contractStore.put(nativeToken.hash, nativeToken.encoded)
  }


  const validators = await createMessage('./chain/dist/contracts/validators.js', [nativeToken.hash])

  if (!await contractStore.has(validators.hash)) {
    await contractStore.put(validators.hash, validators.encoded)
  }


  const nameService = await createMessage('./chain/dist/contracts/nameService.js', [factory.hash, nativeToken.hash, validators.hash, BigNumber.from('1000')])

  if (!await contractStore.has(nameService.hash)) {
    await contractStore.put(nameService.hash, nameService.encoded)
  }
  const addresses = {
    contractFactory: factory.hash,
    nativeToken: nativeToken.hash,
    nameService: nameService.hash,
    validators: validators.hash
  }



  const bytecodes = {
    contractFactory: await factory.toString(),
    nativeToken: await nativeToken.toString(),
    nameService: await nameService.toString(),
    validators: await validators.toString()
  }

  await write(join(process.cwd(), 'src/addresses.json'), JSON.stringify(addresses, null, '\t'))
  await write(join(process.cwd(), 'src/bytecodes.json'), JSON.stringify(bytecodes, null, '\t'))
})()
