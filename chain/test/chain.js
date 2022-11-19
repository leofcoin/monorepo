
(async () => {
  globalThis.DEBUG = true
  const Chain = require('./../dist/chain');
  const Node = require('./../dist/node');
  let imp = await import('../../networks/networks.js')
  const networks = imp.default
  console.log(networks.leofcoin.peach);
  const node = await new Node({
    network: 'leofcoin:peach',
    networkName: 'leofcoin:peach',
    networkVersion: 'peach',
    stars: networks.leofcoin.peach.stars
  })
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
console.log(peernet.selectedAccount);
      await chain.participate(peernet.selectedAccount)
      console.log(peernet.selectedAccount);
const job = async () => {
  // setTimeout(async () => {
    let tx
    // try {
    //   tx = await chain.createTransaction(chain.nativeToken, 'grantRole', [peernet.selectedAccount, 'MINT'])
    //   await tx.wait()

    // } catch (e) {
    //   console.log({e});
    // }

    // try {
    //   tx = await chain.createTransaction(chain.nativeToken, 'mint', [peernet.selectedAccount, chain.utils.parseUnits('100000000000000').toString()])

    //   await tx.wait()
    // } catch (e) {
    //   console.log({e});
    // }
    // return
    let nonce = await chain.getNonce(peernet.selectedAccount)
    console.log({nonce});
    // return
    let promises = []
    // nonce += 1
    for (let i = 0; i < 10; i++) {
      // contract , method, from, to, amount, (optional) nonce
      nonce += 1
      promises.push(chain.createTransaction(chain.nativeToken, 'transfer', [peernet.selectedAccount, '6zqut21djrRNJAniaTByovGhnBGs5h9wfkP35mzjZkEBZwnQVo', chain.utils.parseUnits('100').toString()], nonce))
    }
    promises = await Promise.allSettled(promises)
    promises = await Promise.allSettled(promises.map(({value}) => value.wait()))
    promises.forEach((item, i) => {
      if (item.reason) console.log(item.reason);
    });

    console.log(`${(new Date().getTime() - start) / 1000} s`);

    balances = await chain.balances
    console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
    console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);
// return
//     // setTimeout(async () => {
    promises = []

    // nonce += 1
    for (let i = 0; i < 100; i++) {
      // contract , method, from, to, amount, (optional) nonce
      
      nonce += 1
      promises.push(chain.createTransaction(chain.nativeToken, 'transfer', [peernet.selectedAccount, '6zqut21djrRNJAniaTByovGhnBGs5h9wfkP35mzjZkEBZwnQVo', chain.utils.parseUnits('100').toString()], nonce))
    }
    promises = await Promise.allSettled(promises)
    promises = await Promise.allSettled(promises.map(({value}) => value.wait()))
    balances = await chain.balances
    console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
    console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);

    promises = []

    // nonce += 1
    for (let i = 0; i < 100; i++) {
      // contract , method, from, to, amount, (optional) nonce
      
      nonce += 1
      promises.push(chain.createTransaction(chain.nativeToken, 'transfer', [peernet.selectedAccount, '6zqut21djrRNJAniaTByovGhnBGs5h9wfkP35mzjZkEBZwnQVo', chain.utils.parseUnits('100').toString()], nonce))
    }
    promises = await Promise.allSettled(promises)
    promises = await Promise.allSettled(promises.map(({value}) => value.wait()))
    balances = await chain.balances
    console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
    console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);
      // }, 10000);

// job()
  // }, 5000);
}

// setTimeout(function () {
//   start = new Date().getTime()
//   console.log(peernet.connections);
// }, 10000);
  try {
    job()
  } catch (e) {
    console.warn(e);
  }
  return peernet
})()
