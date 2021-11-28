const test = require('tape');
const m = require('./../../../leofcoin/lfc-api/commonjs.js');

// test('wetalk-api', async tape => {
  // tape.plan(2);
(async () => {
  try {
    const mm = await new m({start: true, init: true, forceJS: false, star: false}, 'earth')
    const ethers = await ipfs.addFromFs('D:/Workspace/arteon/monorepo/third-party-on-ipfs/third-party/ethers.js', {recursive: true})

    for (const {cid, path} of ethers) {
      if (path === 'ethers.js') {
        // setTimeout(async () => {
          console.log(`ethers: cid: ${cid.toString()}`);
        // }, 5000);
      }
    }
  } catch (e) {
    console.log(e);
  }
})()
  // }
// const c = await mm.config.get()
// console.log(c);
//   const code = await mm.account.generateQR('hello');
//   // tape.equal(codes[0], code)
//   const code1 = await mm.account.generateProfileQR({peerID: 'none', mnemonic: 'none'})
//   // tape.equal(codes[1], code1)
//
//   // const generated = await mm.account.generateProfile()
//   // console.log(generated);
//
//   // const qr = await mm.account.export('password')
//   // console.log(qr);
//   await mm.rm('hello')
  // mm.subscribe('peer:connected', async () => {
  //   try {
  //     // const hello = await mm.get('hello')
  //     const web = await mm.get('2kdzsN4s7WYxQhD9q5EA7mtQS1yGjBQHLRTH23XvzHQcCxeJiz')
  //     console.log({web});
  //   } catch (e) {
  //     console.error(e);
  //   }
  // })

// })
// (async () => {
//   try {
//     console.log(m);
//     console.log();
//     console.log();
//   } catch (e) {
//     console.log(e);
//   } finally {
//
//   }
// })();
