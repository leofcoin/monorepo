import { signTransaction } from '@leofcoin/lib'
import { TransactionMessage } from '@leofcoin/messages';
import networks from '@leofcoin/networks';


  globalThis.DEBUG = true
  const Chain = await import('../exports/chain.js');
  const Node = await import('../exports/node.js');
  
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
// const job = async () => {
  
  let nonce = await chain.getNonce(peernet.selectedAccount)
  // // setTimeout(async () => {

  let transactions = [
    // {
    //   from: peernet.selectedAccount, 
    //   to: chain.nativeToken, 
    //   method: 'grantRole',
    //   params: [peernet.selectedAccount, 'MINT']
    // },
    {
      // from: peernet.selectedAccount, 
      // to: chain.nativeToken, 
      // method: 'mint',
      // params: [peernet.selectedAccount, chain.utils.parseUnits('100000000000000').toString()]
    }
  ]
    let tx
    try {
      transactions = await Promise.all(transactions.map(tx => chain.createTransaction(tx)))
      transactions = await Promise.all(transactions.map(tx => signTransaction(tx, peernet.identity)))
      transactions = await Promise.all(transactions.map(tx => chain.sendTransaction(tx)))
      transactions = await Promise.all(transactions.map(tx => tx.wait))
    } catch (e) {
      console.log({e});
    }
    // return
  //   console.log({nonce});
    let balances = await chain.balances
    console.log({balances});

// return setTimeout(() => {}, 60000)
    // console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
    // console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);
    // return
    let promises = []
    // nonce += 
    nonce = await chain.getNonce(peernet.selectedAccount)
    // await chain.clearPool()
    // return
    for (let i = 0; i < 1000; i++) {
      // contract , method, from, to, amount, (optional) nonce
      nonce += 1
      const rawTransaction = await chain.createTransaction({
        from: peernet.selectedAccount, 
        to: chain.nativeToken, 
        method: 'transfer',
        nonce,
        params: [peernet.selectedAccount, 'YTqx4M6m1tEfJCD9Xah3i1igJuR6eZCZdHoZ7wvKyAns1e2NqSFDx', chain.utils.parseUnits('100000').toString()]
      })
      const transaction = await signTransaction(rawTransaction, peernet.identity)
      promises.push(chain.sendTransaction(transaction))
    }
    promises = await Promise.allSettled(promises)
    console.time('transactions handled')
    promises = await Promise.allSettled(promises.map(({value}) => value.wait))
    console.timeEnd('transactions handled')
    
    // balances = await chain.balances
    // console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
    // console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);

    // let d = await peernet.get('BA5XCAC6ILRTE7VHMCTCOTLWFRSY56IALYN4TXIJ37RWLFFC6OFW5MWVJA')
    // console.log({d});
// return setTimeout(() => {}, 600000)
//     // setTimeout(async () => {
    // promises = []
    // nonce = await chain.getNonce(peernet.selectedAccount)
    // // nonce += 1
    // for (let i = 0; i < 10; i++) {
    //   // contract , method, from, to, amount, (optional) nonce
    //   nonce += 1
    //   const rawTransaction = await chain.createTransaction({
    //     from: peernet.selectedAccount, 
    //     to: chain.nativeToken, 
    //     method: 'transfer',
    //     nonce,
    //     params: [peernet.selectedAccount, 'YTqx4M6m1tEfJCD9Xah3i1igJuR6eZCZdHoZ7wvKyAns1e2NqSFDx', chain.utils.parseUnits('100').toString()]
    //   })
    //   const transaction = await signTransaction(rawTransaction, peernet.identity)
    //   if (i === 0) console.log(transaction);
    //   promises.push(chain.sendTransaction(transaction))
    // }
//     promises = await Promise.allSettled(promises)
//     console.log({promises});
//     promises = await Promise.allSettled(promises.map(({value}) => value.wait))
//     balances = await chain.balances
//     console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
//     console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);

//     promises = []
//     nonce = await chain.getNonce(peernet.selectedAccount)

//     const createSignSendTransaction = async (nonce) => {
//       const rawTransaction = await chain.createTransaction({
//         from: peernet.selectedAccount, 
//         to: chain.nativeToken, 
//         method: 'transfer',
//         nonce,
//         params: [peernet.selectedAccount, 'YTqzu5jCU98Krtdaa9LADuBaicZ91UrJWMVaJNm5AKSoteca4DYXa', chain.utils.parseUnits('100').toString()]
//       })
//       const transaction = await signTransaction(rawTransaction, peernet.identity)
//       return chain.sendTransaction(transaction)
//     }
//     // nonce += 1
//     for (let i = 0; i < 100; i++) {
//       nonce += 1
//       promises.push(createSignSendTransaction(nonce))
//     }
//     promises = await Promise.allSettled(promises)
//     promises = await Promise.allSettled(promises.map(({value}) => value.wait))
//     balances = await chain.balances
//     console.log(`balance for ${Object.keys(balances)[0]}:${chain.utils.formatUnits(balances[Object.keys(balances)[0]]).toString()}`);
//     console.log(`balance for ${Object.keys(balances)[1]}:${chain.utils.formatUnits(balances[Object.keys(balances)[1]]).toString()}`);
//       // }, 10000);
//     // const exported = await peernet.identity.export('password')
//     // const exportedQR = await peernet.identity.exportQR('password')
//     // console.log(exported); 
//     // console.log(exportedQR);
//       // job()
//   // }, 5000);
// // }

// // setTimeout(function () {
// //   start = new Date().getTime()
// //   console.log(peernet.connections);
// // }, 10000);
//   // try {
//   //   job()
//   // } catch (e) {
//   //   console.warn(e);
//   // }

