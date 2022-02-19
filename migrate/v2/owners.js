const ethers = require('ethers')
const addresses = require('./../../addresses/addresses/binance-smartchain.json');
const PLATFORM_ABI = require('./../../build/contracts/ArtOnlinePlatform.json')
const MINING_ABI = require('./../../build/contracts/ArtOnlineMining.json')
const ARTONLINE_ABI = require('./../../build/contracts/ArtOnline.json')
const dotenv = require('dotenv').config()
const config = dotenv.parsed
const {writeFile} = require('fs')
const {promisify} = require('util')
const write = promisify(writeFile)
const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org', {
  chainId: 56
})
const signer = new ethers.Wallet(config.MAIN_PRIVATEKEY, provider)

const oldPlatform = new ethers.Contract('0x1468221dc940909A0a85867d71351d2dA4A3AF0e', PLATFORM_ABI.abi, signer)
const oldMining = new ethers.Contract('0x1468221dc940909A0a85867d71351d2dA4A3AF0e', MINING_ABI.abi, provider)
console.log();
const list = [
	{
		"token": 4,
		"tokenId": 272
	},
	{
		"token": 4,
		"tokenId": 273
	},
	{
		"token": 4,
		"tokenId": 274
	},
	{
		"token": 4,
		"tokenId": 277
	},
	{
		"token": 4,
		"tokenId": 278
	},
	{
		"token": 4,
		"tokenId": 279
	},
	{
		"token": 4,
		"tokenId": 280
	},
	{
		"token": 4,
		"tokenId": 281
	},
	{
		"token": 4,
		"tokenId": 282
	},
	{
		"token": 4,
		"tokenId": 283
	},
	{
		"token": 4,
		"tokenId": 284
	},
	{
		"token": 4,
		"tokenId": 290
	},
	{
		"token": 4,
		"tokenId": 291
	},
	{
		"token": 4,
		"tokenId": 292
	},
	{
		"token": 4,
		"tokenId": 293
	},
	{
		"token": 4,
		"tokenId": 294
	},
	{
		"token": 4,
		"tokenId": 295
	},
	{
		"token": 4,
		"tokenId": 296
	},
	{
		"token": 4,
		"tokenId": 370
	},
	{
		"token": 4,
		"tokenId": 371
	},
	{
		"token": 4,
		"tokenId": 372
	},
	{
		"token": 4,
		"tokenId": 373
	},
	{
		"token": 4,
		"tokenId": 374
	},
	{
		"token": 4,
		"tokenId": 375
	},
	{
		"token": 4,
		"tokenId": 376
	},
	{
		"token": 4,
		"tokenId": 379
	},
	{
		"token": 4,
		"tokenId": 380
	},
	{
		"token": 4,
		"tokenId": 381
	},
	{
		"token": 4,
		"tokenId": 382
	},
	{
		"token": 4,
		"tokenId": 383
	},
	{
		"token": 4,
		"tokenId": 384
	},
	{
		"token": 4,
		"tokenId": 385
	},
	{
		"token": 4,
		"tokenId": 386
	},
	{
		"token": 4,
		"tokenId": 387
	},
	{
		"token": 4,
		"tokenId": 388
	},
	{
		"token": 4,
		"tokenId": 389
	},
	{
		"token": 4,
		"tokenId": 390
	},
	{
		"token": 4,
		"tokenId": 391
	},
	{
		"token": 4,
		"tokenId": 392
	},
	{
		"token": 4,
		"tokenId": 393
	},
	{
		"token": 4,
		"tokenId": 394
	},
	{
		"token": 4,
		"tokenId": 395
	},
	{
		"token": 4,
		"tokenId": 396
	},
	{
		"token": 4,
		"tokenId": 397
	},
	{
		"token": 4,
		"tokenId": 398
	},
	{
		"token": 4,
		"tokenId": 399
	},
	{
		"token": 4,
		"tokenId": 400
	},
	{
		"token": 4,
		"tokenId": 401
	},
	{
		"token": 4,
		"tokenId": 402
	},
	{
		"token": 4,
		"tokenId": 403
	},
	{
		"token": 4,
		"tokenId": 404
	},
	{
		"token": 4,
		"tokenId": 405
	},
	{
		"token": 4,
		"tokenId": 408
	},
	{
		"token": 4,
		"tokenId": 410
	},
	{
		"token": 4,
		"tokenId": 411
	},
	{
		"token": 4,
		"tokenId": 412
	},
	{
		"token": 4,
		"tokenId": 413
	},
	{
		"token": 4,
		"tokenId": 414
	},
	{
		"token": 4,
		"tokenId": 415
	},
	{
		"token": 4,
		"tokenId": 416
	},
	{
		"token": 4,
		"tokenId": 417
	},
	{
		"token": 4,
		"tokenId": 418
	},
	{
		"token": 4,
		"tokenId": 419
	},
	{
		"token": 4,
		"tokenId": 420
	},
	{
		"token": 4,
		"tokenId": 421
	},
	{
		"token": 4,
		"tokenId": 422
	},
	{
		"token": 4,
		"tokenId": 423
	},
	{
		"token": 4,
		"tokenId": 424
	},
	{
		"token": 4,
		"tokenId": 425
	},
	{
		"token": 4,
		"tokenId": 426
	},
	{
		"token": 4,
		"tokenId": 427
	},
	{
		"token": 4,
		"tokenId": 428
	},
	{
		"token": 4,
		"tokenId": 429
	},
	{
		"token": 4,
		"tokenId": 430
	},
	{
		"token": 4,
		"tokenId": 431
	},
	{
		"token": 4,
		"tokenId": 432
	},
	{
		"token": 4,
		"tokenId": 433
	},
	{
		"token": 4,
		"tokenId": 434
	},
	{
		"token": 4,
		"tokenId": 435
	},
	{
		"token": 4,
		"tokenId": 436
	},
	{
		"token": 4,
		"tokenId": 439
	},
	{
		"token": 4,
		"tokenId": 440
	},
	{
		"token": 4,
		"tokenId": 441
	},
	{
		"token": 4,
		"tokenId": 442
	},
	{
		"token": 4,
		"tokenId": 449
	},
	{
		"token": 4,
		"tokenId": 450
	},
	{
		"token": 4,
		"tokenId": 451
	},
	{
		"token": 4,
		"tokenId": 452
	},
	{
		"token": 4,
		"tokenId": 453
	},
	{
		"token": 4,
		"tokenId": 454
	},
	{
		"token": 4,
		"tokenId": 455
	},
	{
		"token": 4,
		"tokenId": 456
	},
	{
		"token": 4,
		"tokenId": 457
	},
	{
		"token": 4,
		"tokenId": 458
	},
	{
		"token": 4,
		"tokenId": 459
	},
	{
		"token": 4,
		"tokenId": 460
	},
	{
		"token": 4,
		"tokenId": 461
	},
	{
		"token": 4,
		"tokenId": 462
	},
	{
		"token": 4,
		"tokenId": 463
	},
	{
		"token": 4,
		"tokenId": 464
	},
	{
		"token": 4,
		"tokenId": 465
	},
	{
		"token": 4,
		"tokenId": 466
	},
	{
		"token": 4,
		"tokenId": 467
	},
	{
		"token": 4,
		"tokenId": 468
	},
	{
		"token": 4,
		"tokenId": 469
	},
	{
		"token": 4,
		"tokenId": 470
	},
	{
		"token": 4,
		"tokenId": 471
	},
	{
		"token": 4,
		"tokenId": 472
	},
	{
		"token": 4,
		"tokenId": 473
	},
	{
		"token": 4,
		"tokenId": 474
	},
	{
		"token": 4,
		"tokenId": 475
	},
	{
		"token": 4,
		"tokenId": 476
	},
	{
		"token": 4,
		"tokenId": 477
	},
	{
		"token": 4,
		"tokenId": 478
	},
	{
		"token": 4,
		"tokenId": 479
	},
	{
		"token": 4,
		"tokenId": 480
	},
	{
		"token": 4,
		"tokenId": 481
	},
	{
		"token": 4,
		"tokenId": 482
	},
	{
		"token": 4,
		"tokenId": 483
	},
	{
		"token": 4,
		"tokenId": 484
	},
	{
		"token": 4,
		"tokenId": 485
	},
	{
		"token": 4,
		"tokenId": 486
	},
	{
		"token": 4,
		"tokenId": 487
	},
	{
		"token": 4,
		"tokenId": 488
	},
	{
		"token": 4,
		"tokenId": 489
	},
	{
		"token": 4,
		"tokenId": 490
	},
	{
		"token": 4,
		"tokenId": 491
	},
	{
		"token": 4,
		"tokenId": 492
	},
	{
		"token": 4,
		"tokenId": 493
	},
	{
		"token": 4,
		"tokenId": 494
	},
	{
		"token": 4,
		"tokenId": 495
	},
	{
		"token": 4,
		"tokenId": 496
	},
	{
		"token": 4,
		"tokenId": 497
	},
	{
		"token": 4,
		"tokenId": 498
	},
	{
		"token": 4,
		"tokenId": 499
	},
	{
		"token": 4,
		"tokenId": 500
	},
	{
		"token": 4,
		"tokenId": 501
	},
	{
		"token": 4,
		"tokenId": 502
	},
	{
		"token": 4,
		"tokenId": 503
	},
	{
		"token": 4,
		"tokenId": 504
	},
	{
		"token": 4,
		"tokenId": 505
	},
	{
		"token": 4,
		"tokenId": 506
	},
	{
		"token": 4,
		"tokenId": 507
	},
	{
		"token": 4,
		"tokenId": 508
	},
	{
		"token": 4,
		"tokenId": 509
	},
	{
		"token": 4,
		"tokenId": 510
	},
	{
		"token": 4,
		"tokenId": 511
	},
	{
		"token": 4,
		"tokenId": 512
	},
	{
		"token": 4,
		"tokenId": 513
	},
	{
		"token": 4,
		"tokenId": 514
	},
	{
		"token": 4,
		"tokenId": 515
	},
	{
		"token": 4,
		"tokenId": 516
	},
	{
		"token": 4,
		"tokenId": 517
	},
	{
		"token": 4,
		"tokenId": 518
	},
	{
		"token": 4,
		"tokenId": 519
	},
	{
		"token": 4,
		"tokenId": 520
	},
	{
		"token": 4,
		"tokenId": 521
	},
	{
		"token": 4,
		"tokenId": 522
	},
	{
		"token": 4,
		"tokenId": 523
	},
	{
		"token": 4,
		"tokenId": 524
	},
	{
		"token": 4,
		"tokenId": 525
	},
	{
		"token": 4,
		"tokenId": 526
	},
	{
		"token": 4,
		"tokenId": 527
	},
	{
		"token": 4,
		"tokenId": 528
	},
	{
		"token": 4,
		"tokenId": 529
	},
	{
		"token": 4,
		"tokenId": 530
	},
	{
		"token": 4,
		"tokenId": 531
	},
	{
		"token": 4,
		"tokenId": 532
	},
	{
		"token": 4,
		"tokenId": 533
	},
	{
		"token": 4,
		"tokenId": 534
	},
	{
		"token": 4,
		"tokenId": 535
	},
	{
		"token": 4,
		"tokenId": 536
	},
	{
		"token": 4,
		"tokenId": 537
	},
	{
		"token": 4,
		"tokenId": 538
	},
	{
		"token": 4,
		"tokenId": 539
	},
	{
		"token": 4,
		"tokenId": 540
	},
	{
		"token": 4,
		"tokenId": 541
	},
	{
		"token": 4,
		"tokenId": 542
	},
	{
		"token": 4,
		"tokenId": 543
	},
	{
		"token": 4,
		"tokenId": 544
	},
	{
		"token": 4,
		"tokenId": 545
	},
	{
		"token": 4,
		"tokenId": 546
	},
	{
		"token": 4,
		"tokenId": 547
	},
	{
		"token": 4,
		"tokenId": 548
	},
	{
		"token": 4,
		"tokenId": 549
	},
	{
		"token": 4,
		"tokenId": 550
	},
	{
		"token": 4,
		"tokenId": 551
	},
	{
		"token": 4,
		"tokenId": 552
	},
	{
		"token": 4,
		"tokenId": 553
	},
	{
		"token": 4,
		"tokenId": 554
	},
	{
		"token": 4,
		"tokenId": 555
	},
	{
		"token": 4,
		"tokenId": 556
	},
	{
		"token": 4,
		"tokenId": 557
	},
	{
		"token": 4,
		"tokenId": 558
	},
	{
		"token": 4,
		"tokenId": 559
	},
	{
		"token": 4,
		"tokenId": 560
	},
	{
		"token": 4,
		"tokenId": 561
	},
	{
		"token": 4,
		"tokenId": 562
	},
	{
		"token": 4,
		"tokenId": 563
	},
	{
		"token": 4,
		"tokenId": 564
	},
	{
		"token": 4,
		"tokenId": 565
	},
	{
		"token": 4,
		"tokenId": 566
	},
	{
		"token": 4,
		"tokenId": 567
	},
	{
		"token": 4,
		"tokenId": 568
	},
	{
		"token": 4,
		"tokenId": 569
	},
	{
		"token": 4,
		"tokenId": 570
	},
	{
		"token": 4,
		"tokenId": 571
	},
	{
		"token": 4,
		"tokenId": 572
	},
	{
		"token": 4,
		"tokenId": 574
	},
	{
		"token": 4,
		"tokenId": 575
	},
	{
		"token": 4,
		"tokenId": 576
	},
	{
		"token": 4,
		"tokenId": 577
	},
	{
		"token": 4,
		"tokenId": 578
	},
	{
		"token": 4,
		"tokenId": 579
	},
	{
		"token": 4,
		"tokenId": 580
	},
	{
		"token": 4,
		"tokenId": 581
	},
	{
		"token": 4,
		"tokenId": 583
	},
	{
		"token": 4,
		"tokenId": 584
	},
	{
		"token": 4,
		"tokenId": 585
	},
	{
		"token": 4,
		"tokenId": 586
	},
	{
		"token": 4,
		"tokenId": 587
	},
	{
		"token": 4,
		"tokenId": 588
	},
	{
		"token": 4,
		"tokenId": 590
	}
]


const wait = () => new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve()
  }, 20000);
});

const platform = new ethers.Contract(addresses.platform, PLATFORM_ABI.abi, signer)
const mining = new ethers.Contract(addresses.mining, MINING_ABI.abi, signer)
const artonline = new ethers.Contract(addresses.artonline, ARTONLINE_ABI.abi, signer)

const tokenLength = 4

const tokens = []
const tokenIds = [];

const totalSupply = {};
const pools = {};
const earnings = {};
let earners = {};
const batch = {};
const batched = {};

const notMining = [];

(async () => {
// let earnings
//    earnings = await oldMining.callStatic.earned('0xA44DaD793827464b14C62d44De3d7076c73A015a', '4')
// console.log(earnings);
//   artonline.mint('0xA44DaD793827464b14C62d44De3d7076c73A015a', earnings)
  // return

  // for (const {token, tokenId} of list) {
    // const address = await platform.callStatic.ownerOf(token, tokenId)


    let tx = await mining.activateGPUBatch('0x9570d17b4C8524104dEe6Ab2b24C8Cf856b05c17', [4, 4, 4, 4, 4, 4, 4, 4,], [483, 484, 485, 486, 487, 488, 489, 490, 491])
    await tx.wait()
    await wait()
    return
    // console.log(address, token, tokenId);
  // }
// let token = 4
//   // for (let token = 0; token <= tokenLength; token++) {
//     let cap = await platform.callStatic.totalSupply(token)
//     cap = cap.toNumber()
//     totalSupply[token] = cap
//     for (let i = 1; i <= cap; i++) {
//
//       const isMining = await mining.callStatic.mining(token, i)
//       console.log(isMining.toNumber());
//       if (isMining.toNumber() === 0) list.push({token, tokenId: i})
//     }
//     // console.log(notMining);

  // }

  // await write('notmining.json', JSON.stringify(list, null, '\t'))
return

  //   let owners = await oldPlatform.callStatic.ownerOfBatch(tokens, tokenIds)
  //
  //   owners = owners.reduce((p, c) => {
  //     if (p.indexOf(c) === -1) p.push(c)
  //     return p
  //   }, [])
  //
  //   batch[token] = {}
  //   for (const owner of owners) {
  //     const amount = await oldPlatform.callStatic.balanceOf(owner, token)
  //     if (amount.toString() !== '0') batch[token][owner] = amount.toString()
  //   }
  // }
let nonce = await signer.getTransactionCount()
let previousToken
let previousId
const totalMints = {}
  for (const key of Object.keys(batch)) {
    totalMints[key] = 0
    for (const address of Object.keys(batch[key])) {
      // if (list[address]) {
      //   try {
      //     console.log('minting');
      //     console.log(address, ethers.utils.parseUnits(list[key].toString()).toString())
      //     // let tx = await artonline.mint(address, ethers.utils.parseUnits(list[key].toString()).toString(), {nonce: nonce++})
      //     // await tx.wait()
      //   } catch (e) {
      //     nonce = nonce - 1
      //   }
      // }
      try {
        console.log('minting assets');
        tx = await platform._mintAssets(address, key, batch[key][address])
        await tx.wait()
      } catch (e) {
        console.log(e);
      }
      // totalMints[key] += Number(batch[key][address])
      // let _totalMints = totalMints[key]
      //
      // const tokens = []
      // const ids = []
      // for (let i = 1; i <= Number(batch[key][address]); i++) {
      //   ids.push(key)
      //   tokens.push(_totalMints)
      //
      //   _totalMints -= 1
      // }
      // try {
        // console.log('activating');
        // console.log(address, ids, tokens);
        // tx = await mining.activateGPUBatch(address, ids, tokens)
        // await tx.wait()
      // } catch (e) {
        // console.log(e);
      // }
      // let earning = await oldMining.callStatic.earned(address, key)
      // earning = ethers.utils.formatUnits(earning)
      // if (address === '0x1f94a873a0eA1Ab63D9d50cDc5e85fDc9b7cFe71' && key === '3') earning = 40020.925
      // earnings[address] = earnings[address] ? earnings[address] += Number(earning) : Number(earning)
    }
  }

  // console.log(earnings);

  return
  // console.log(batch[0]);
  // console.log(batch[1]);
  // console.log(batch[2]);
  // console.log(batch[3]);
  // console.log(batch[4]);
return
  delete earners[5]

  for (let key of Object.keys(earners)) {
    for (address of earners[key]) {

    }
  }

  console.log('done earnings');
// pause platform
// let pausing = oldPlatform.pause()
// await pausing.wait()
// console.log('platform paused');
console.log('migrating platform');
// let nonce = await signer.getTransactionCount()

//   for (const key of Object.keys(batch)) {
//     for (const address of Object.keys(batch[key])) {
//       try {
//         let tx = await platform.mintBatch(address, batch[key][address].ids, batch[key][address].tokens, {nonce: nonce++})
//         console.log(tx);
//         await tx.wait()
//       } catch (e) {
//         nonce--
// console.warn(`ignored ${key, address}`);
//       } finally {
//
//       }
//     }
//   }
// console.log('minted cards');

  // for (let key of Object.keys(earnings)) {
  //   // console.log(ethers.utils.formatUnits(earnings[key]).toString());
  //   if (earnings[key] == 0) return
  //
  //
  //   let tx = await artonline.mint(key, ethers.utils.parseUnits(earnings[key].toString()).toString(), {nonce: nonce++})
  //   await tx.wait()
  // }
console.log('minted rewards');
delete batch[5]

  for (const key of Object.keys(batch)) {
    for (const address of Object.keys(batch[key])) {
      let tx = await mining.activateGPUBatch(address, batch[key][address].ids, batch[key][address].tokens, {nonce: nonce++})
      await tx.wait()
    }
  }


  // console.log(earnings);
  // write('earnings.json', JSON.stringify(earnings, null, '\t'))
  // write('owners.json', JSON.stringify(owners, null, '\t'))
  // console.log(totalSupply);
  // console.log(owners);
})()
