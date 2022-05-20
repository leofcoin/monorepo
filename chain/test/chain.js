

(async () => {
  globalThis.DEBUG = true
  const Chain = require('./../dist/chain');
  const Node = require('./../dist/node');
  const node = await new Node()
  const chain = await new Chain()
  let start
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
      // let balances = chain.balances
      // console.log({balances});
      // console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
      // console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);
const job = async () => {
  setTimeout(async () => {

    let tx
  try {
    tx = await chain.createTransaction(chain.nativeToken, 'grantRole', [peernet.id, 'MINT'])
    await tx.wait()


  } catch (e) {
    console.log(e);
  }

  try {
    tx = await chain.createTransaction(chain.nativeToken, 'mint', [peernet.id, chain.utils.parseUnits('1000000000').toString()])
    await tx.wait()
  } catch (e) {
    console.log(e);
  }
    let promises = []
    // nonce += 1
    for (let i = 0; i < 10; i++) {
      // contract , method, from, to, amount, (optional) nonce
      promises.push(chain.createTransaction(chain.nativeToken, 'transfer', [peernet.id, '3CzV5vEE3nceXUXe8vTpRz95dBhL8V54zKjAGd8YxjCmdW2J8ZxrYw', chain.utils.parseUnits('100').toString()]))
    }
promises = await Promise.allSettled(promises)
console.log({promises});
promises = await Promise.allSettled(promises.map(({value}) => value.wait()))
console.log({promises});
promises.forEach((item, i) => {
  if (item.reason) console.log(item.reason);
});

console.log(promises[1].reason);
// console.log(promises);
// await promises[promises.length - 1].value.wait()
// promises = []
//     for (let i = 0; i < 50; i++) {
//       promises.push(chain.createTransaction(chain.nativeToken, 'transfer', ['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000001', 100]))
//     }

//   promises = await Promise.all(promises)
// await promises[promises.length - 1].wait()
console.log(`${(new Date().getTime() - start) / 1000} s`);
// setTimeout(function () {
//   const balances =  chain.balances
//   console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
//   console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);
//
// }, 30000);
    // console.log({tx});
    // let result =  chain.mint('0x0000000000000000000000000000000000000000', 100)
    // result =  chain.transfer('0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000001', 100)


      balances = chain.balances
      console.log({balances});
      console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
      console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);

      // setTimeout(async () => {
        promises = []
        console.log('run');
        // nonce += 1
        for (let i = 0; i < 100; i++) {
          // contract , method, from, to, amount, (optional) nonce
          promises.push(chain.createTransaction(chain.nativeToken, 'transfer', [peernet.id, '3CzV5vEE3nceXUXe8vTpRz95dBhL8V54zKjAGd8YxjCmdW2J8ZxrYw', chain.utils.parseUnits('100').toString()]))
          // nonce += 1
        }
    promises = await Promise.allSettled(promises)
    promises = await Promise.allSettled(promises.map(({value}) => value.wait()))
    balances = chain.balances
    console.log({balances});
    console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
    console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);
      // }, 10000);

// job()
}, 5000);
}

setTimeout(function () {
  start = new Date().getTime()
  console.log(peernet.connections);
}, 10000);
  try {
    job()
  } catch (e) {
    console.warn(e);
  }
})()
