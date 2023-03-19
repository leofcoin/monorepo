import { signTransaction } from '@leofcoin/lib'

  globalThis.DEBUG = true
  const Chain = await import('./../exports/chain.js');
  const Node = await import('./../exports/node.js');
  let imp = await import('../../networks/networks.js')
  const networks = imp.default
  
  const node = await new Node.default({
    network: 'leofcoin:peach',
    networkName: 'leofcoin:peach',
    networkVersion: 'peach',
    stars: networks.leofcoin.peach.stars,
    autoStart: false
  })
  
  const chain = await new Chain.default()
  let start
  // console.log(peernet.identity.sign());
  
      await chain.participate(peernet.selectedAccount)
      console.log(peernet.selectedAccount);
const job = async () => {
  
  let nonce = await chain.getNonce(peernet.selectedAccount)
  // // setTimeout(async () => {

  // let transactions = [
  //   {
  //     from: peernet.selectedAccount, 
  //     to: chain.nativeToken, 
  //     method: 'grantRole',
  //     params: [peernet.selectedAccount, 'MINT']
  //   },
  //   {
  //     from: peernet.selectedAccount, 
  //     to: chain.nativeToken, 
  //     method: 'mint',
  //     params: [peernet.selectedAccount, chain.utils.parseUnits('100000000000000').toString()]
  //   }
  // ]
  //   let tx
  //   try {
  //     transactions = await Promise.all(transactions.map(tx => chain.createTransaction(tx)))
  //     transactions = await Promise.all(transactions.map(tx => signTransaction(tx, peernet.identity)))
  //     transactions = await Promise.all(transactions.map(tx => chain.sendTransaction(tx)))
  //     transactions = await Promise.all(transactions.map(tx => tx.wait))
  //   } catch (e) {
  //     console.log({e});
  //   }
  //   return
  //   console.log({nonce});
    let balances = await chain.balances
    console.log({balances});
return
    // return
    // console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
    // console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);
    // return
    let promises = []
    // nonce += 
    nonce = await chain.getNonce(peernet.selectedAccount)
    for (let i = 0; i < 100; i++) {
      // contract , method, from, to, amount, (optional) nonce
      nonce += 1
      const rawTransaction = await chain.createTransaction({
        from: peernet.selectedAccount, 
        to: chain.nativeToken, 
        method: 'transfer',
        nonce,
        params: [peernet.selectedAccount, 'YTqzu5jCU98Krtdaa9LADuBaicZ91UrJWMVaJNm5AKSoteca4DYXa', chain.utils.parseUnits('100').toString()]
      })
      const transaction = await signTransaction(rawTransaction, peernet.identity)
      promises.push(chain.sendTransaction(transaction))
    }
    promises = await Promise.allSettled(promises)
    promises = await Promise.allSettled(promises.map(({value}) => value.wait))

    console.log(`${(new Date().getTime() - start) / 1000} s`);

    balances = await chain.balances
    console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
    console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);
return
//     // setTimeout(async () => {
    promises = []
    nonce = await chain.getNonce(peernet.selectedAccount)
    // nonce += 1
    for (let i = 0; i < 10; i++) {
      // contract , method, from, to, amount, (optional) nonce
      nonce += 1
      const rawTransaction = await chain.createTransaction({
        from: peernet.selectedAccount, 
        to: chain.nativeToken, 
        method: 'transfer',
        nonce,
        params: [peernet.selectedAccount, 'YTqzu5jCU98Krtdaa9LADuBaicZ91UrJWMVaJNm5AKSoteca4DYXa', chain.utils.parseUnits('100').toString()]
      })
      const transaction = await signTransaction(rawTransaction, peernet.identity)
      promises.push(chain.sendTransaction(transaction))
    }
    promises = await Promise.allSettled(promises)
    promises = await Promise.allSettled(promises.map(({value}) => value.wait))
    balances = await chain.balances
    console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
    console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);

    promises = []
    nonce = await chain.getNonce(peernet.selectedAccount)

    const createSignSendTransaction = async (nonce) => {
      const rawTransaction = await chain.createTransaction({
        from: peernet.selectedAccount, 
        to: chain.nativeToken, 
        method: 'transfer',
        nonce,
        params: [peernet.selectedAccount, 'YTqwTAojA8aZDPYhSFey3KsYb66YdEa4Xe7L6E484VTfMSVvauLZd', chain.utils.parseUnits('100').toString()]
      })
      const transaction = await signTransaction(rawTransaction, peernet.identity)
      return chain.sendTransaction(transaction)
    }
    // nonce += 1
    for (let i = 0; i < 1000; i++) {
      nonce += 1
      promises.push(createSignSendTransaction(nonce))
    }
    promises = await Promise.allSettled(promises)
    promises = await Promise.allSettled(promises.map(({value}) => value.wait))
    balances = await chain.balances
    console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
    console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);
      // }, 10000);
    // const exported = await peernet.identity.export('password')
    // const exportedQR = await peernet.identity.exportQR('password')
    // console.log(exported); 
    // console.log(exportedQR);
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

