

(async () => {
  const {promisify} = require('util')
  const read = promisify(require('fs').readFile)
  const createMessage = async (src, params = []) => {
    const contract = await read(src)
    return chain.createContractMessage(peernet.id, peernet.Buffer.from(`return ${contract.toString().replace(/export{([A-Z])\w+ as default}/g, '')}`), params)
  }
  const Chain = require('./../dist/chain');
  const Node = require('./../dist/node');
  const node = await new Node()
  const chain = await new Chain()
  const factory = await createMessage('./dist/contracts/factory.js')
  console.log({factory: factory.hash});
  if (!await contractStore.has(factory.hash)) {
    await contractStore.put(factory.hash, factory.encoded)
  }

  const nativeToken = await createMessage('./dist/contracts/nativeToken.js')
  if (!await contractStore.has(nativeToken.hash)) {
    await contractStore.put(nativeToken.hash, nativeToken.encoded)
  }
  console.log({nativeToken: nativeToken.hash});


  const validators = await createMessage('./dist/contracts/validators.js', [nativeToken.hash])
  console.log({validators});
  if (!await contractStore.has(validators.hash)) {
    await contractStore.put(validators.hash, validators.encoded)
  }
  console.log({validators: validators.hash});

  const nameService = await createMessage('./dist/contracts/nameService.js', [factory.hash, nativeToken.hash, validators.hash])
  console.log({nameService});
  if (!await contractStore.has(nameService.hash)) {
    await contractStore.put(nameService.hash, nameService.encoded)
  }
  console.log({nameService: nameService.hash});
})()
