const test = require('tape')
const ethers = require('ethers')
const {join} = require('path')
const addresses = require(join(__dirname, './../../addresses/addresses/binance-smartchain-testnet.json'))
// const addresses = require(join(__dirname, './../../addresses/addresses/art-ganache.json'))
const dotenv = require('dotenv').config()
const config = dotenv.parsed
const BRIDGER_ABI = require('./../../build/contracts/ArtOnlineBridger.json');
const PLATFORM_ABI = require('./../../build/contracts/ArtOnlinePlatform.json');
const MINING_ABI = require('./../../build/contracts/ArtOnlineMining.json');
const EXCHANGE_ABI = require('./../../build/contracts/ArtOnlineExchange.json');
const EXCHANGE_FACTORY_ABI = require('./../../build/contracts/ArtOnlineExchangeFactory.json');
const STAKING_ABI = require('./../../build/contracts/ArtOnlineStaking.json');
const ACCESS_ABI = require('./../../build/contracts/ArtOnlineAccess.json');
const ARTONLINE_ABI = require('./../../build/contracts/ArtOnline.json');
const SPLITTER_ABI = require('./../../build/contracts/ArtOnlineSplitter.json');
const PartnershipToken = require('./../../build/contracts/PartnershipToken.json')
const listingInterface = require('./../../build/contracts/ArtOnlineListingERC1155.json')


const provider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545', {
  chainId: 97
})

// const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:1337', {
//   chainId: 1337
// })

const signer = new ethers.Wallet(config.TEST_PRIVATEKEY, provider)
const buyer = new ethers.Wallet(config.TEST_PRIVATEKEY_2, provider)

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
let tx
let stakeIds

const rest = async () => new Promise((resolve, reject) => {
  return setTimeout(() => {
    return resolve()
  }, 2000);
})

const contracts = {
  platform: new ethers.Contract(addresses.platform, PLATFORM_ABI.abi, signer),
  exchangeFactory: new ethers.Contract(addresses.exchangeFactory, EXCHANGE_FACTORY_ABI.abi, signer),
  exchangeFactoryBuyer: new ethers.Contract(addresses.exchangeFactory, EXCHANGE_FACTORY_ABI.abi, buyer),
  platformBuyer: new ethers.Contract(addresses.platform, PLATFORM_ABI.abi, buyer),
  staking: new ethers.Contract(addresses.staking, STAKING_ABI.abi, buyer)
};


  test('mint GOLDGEN', async tape => {
    try {
      tx = await contracts.platform._mintAssets(signer.address, 6, 1)
      await tx.wait()
      tape.ok(true, '')
    } catch (e) {
      tape.ok(false, e)
    }
  })



  test('mint SHIBOKI', async tape => {
    try {
      tx = await contracts.platform._mintAssets(signer.address, 7, 1)
      await tx.wait()
      tape.ok(true, '')
    } catch (e) {
      tape.ok(false, e)
    }
  })


  test('setApprovalForAll exchange factory', async tape => {
    try {
      tx = await contracts.platform.setApprovalForAll(addresses.exchangeFactory, true)
      await tx.wait()
      tape.ok(true, '')
    } catch (e) {
      tape.ok(false, e)
    }
  })
  // await rest()

  test('list GOLDGEN on exchange factory', async tape => {
    try {
      tx = await contracts.exchangeFactory.createListing(addresses.platform, ZERO_ADDRESS, ethers.utils.parseUnits('1'), ethers.BigNumber.from(6), ethers.BigNumber.from(1))
      await tx.wait()
      tape.ok(true, '')
    } catch (e) {
      tape.ok(false, e)
    }
  })


  test('list SHIBOKI as partner on exchange factory', async tape => {
    console.log(addresses);
    try {
      tx = await contracts.exchangeFactory.createPartnerListing(addresses.platform, ZERO_ADDRESS, addresses.splitter, ethers.utils.parseUnits('1.5'), '7', '1')
      await tx.wait()
      tape.ok(true, '')
    } catch (e) {
      tape.ok(false, e)
    }
  });


  test('buy GOLDGEN from exchange factory', async tape => {
    try {
      const listing = await contracts.exchangeFactoryBuyer.callStatic.getListingERC1155(addresses.platform, 6, 1)
      const price = await new ethers.Contract(listing, listingInterface.abi, provider).callStatic.price()
      tx = await contracts.exchangeFactoryBuyer.buy(addresses.platform, 6, 1, {value: price})
      await tx.wait()
      tape.ok(true, '')
    } catch (e) {
      tape.ok(false, e)
    }
  })

  test('buy SHIBOKI from exchange factory', async tape => {
    try {
      const listing = await contracts.exchangeFactoryBuyer.callStatic.getListingERC1155(addresses.platform, 7, 1)
      const price = await new ethers.Contract(listing, listingInterface.abi, provider).callStatic.price()
      tx = await contracts.exchangeFactoryBuyer.buy(addresses.platform, 7, 1, {value: price})
      await tx.wait()
      tape.ok(true, '')
    } catch (e) {
      tape.ok(false, e)
    }
  })

  test('activate GOLDGEN', async tape => {
    try {
      tx = await contracts.platformBuyer.activateGPU('6', '1')
      await tx.wait()
      tape.ok(true, '')
    } catch (e) {
      tape.ok(false, e)
    }
  })

  test('activate SHIBOKI', async tape => {
    try {
      tx = await contracts.platformBuyer.activateGPU('7', '1')
      await tx.wait()
      tape.ok(true, '')
    } catch (e) {
      tape.ok(false, e)
    }
  })

  setTimeout(async () => {
    test('getReward GOLDGEN', async tape => {
      try {
        tx = await contracts.platformBuyer.getReward('6')
        await tx.wait()
        tape.ok(true, '')
      } catch (e) {
        tape.ok(false, e)
      }
    })

    test('stakeReward SHIBOKI', async tape => {
      try {
        tx = await contracts.platformBuyer.stakeReward('7')
        await tx.wait()
        tape.ok(true, '')
      } catch (e) {
        tape.ok(false, e)
      }
    });
    test('stakeIds', async tape => {
      try {
        stakeIds = await contracts.staking.callStatic.stakeIds(buyer.address)
        tape.ok(stakeIds.length > 0, '')
      } catch (e) {
        tape.ok(false, e)
      }
    })

    test('get stakeReward (should fail)', async tape => {
      try {

        tx = await contracts.staking.withdraw(buyer.address, stakeIds[0])
        await tx.wait()
        tape.ok(false, '')
      } catch (e) {
        tape.ok(true, '')
      }
    })
  }, 62 * 1000);
console.log(stakeIds);
  setTimeout(async () => {
    test('get stakeReward', async tape => {
      try {
        tx = await contracts.staking.withdraw(buyer.address, stakeIds[0])
        await tx.wait()
        tape.ok(true, '')
      } catch (e) {
        tape.ok(false, e)
      }
    })
  }, 262 * 1000);
