

(async () => {
  const Chain = require('./../dist/chain');
  const Node = require('./../dist/node');
  const node = await new Node()
  const chain = await new Chain()
  let start
  setTimeout(function () {
    start = new Date().getTime()
  }, 1000);
  //
  // await chain.deleteAll()
  // return
//   try {
//     const contract = await chain.utils.read('./dist/native.js')
//     const address = await chain.deployContract(peernet.Buffer.from(`return ${contract.toString().replace(/export{([A-Z])\w+ as default}/g, '')}`))
//     console.log(address);
//   } catch (e) {
// console.log(e);
//   } finally {
//
//   }
  // '5xdacigaguxg3yjllehp65htk32ha3sztlexxrrhmviobgibz6dt6hkxfu'

await chain.participate()
  try {
    let tx
    await chain.createTransaction(chain.nativeToken, 'grantRole', [peernet.id, 'MINT'])
    let promises = []
    promises.push(chain.createTransaction(chain.nativeToken, 'mint', ['0x0000000000000000000000000000000000000000', '10000000000000']))

    for (let i = 0; i < 50; i++) {
      promises.push(chain.createTransaction(chain.nativeToken, 'transfer', ['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000001', 100]))
    }
promises = await Promise.all(promises)
await promises[promises.length - 1].wait()
promises = []
    for (let i = 0; i < 50; i++) {
      promises.push(chain.createTransaction(chain.nativeToken, 'transfer', ['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000001', 100]))
    }

  promises = await Promise.all(promises)
await promises[promises.length - 1].wait()
console.log(`${(new Date().getTime() - start) / 1000} s`);
setTimeout(function () {
  console.log(chain.balances);
}, 10000);
    // console.log({tx});
    // let result = await chain.mint('0x0000000000000000000000000000000000000000', 100)
    // result = await chain.transfer('0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000001', 100)
    console.log(chain.balances);


  } catch (e) {
    console.warn(e);
  }
})()
