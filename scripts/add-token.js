const addresses = require('./../addresses/addresses/binance-smartchain-testnet.json')
const platform = require('./../build/contracts/ArtOnlinePlatform.json')
const ethers = require('ethers')
const dotenv = require('dotenv').config()
const config = dotenv.parsed

const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org', {
  chainId: 56
})

const signer = new ethers.Wallet(config.TEST_PRIVATEKEY, provider);
const artOnlinePlatform = new ethers.Contract(addresses.platform, platform.abi, signer)

const SixtySeconds = ethers.BigNumber.from('60')

const rewardRates = [
  ethers.utils.parseUnits(((153000 / 2.102e+7) * 50).toString(), 18),
  ethers.utils.parseUnits(((9600 / 3.154e+7) * 400).toString(), 18),
  ethers.utils.parseUnits(((25100 / 2.102e+7) * 250).toString(), 18),
  ethers.utils.parseUnits(((97000 / 2.102e+7) * 133).toString(), 18),
  ethers.utils.parseUnits(((2300 / 3.154e+7) * 1000).toString(), 18)
]

const halvings = [
  ethers.BigNumber.from('1170000'),
  ethers.BigNumber.from('1170000'),
  ethers.BigNumber.from('1170000'),
  ethers.BigNumber.from('1170000'),
  ethers.BigNumber.from('1170000')
];

(async () => {
  let tx
  // tx = await artOnlinePlatform.addToken('GENESIS', ethers.BigNumber.from('0'), ethers.BigNumber.from('50'))
  // await tx.wait()
  tx = await artOnlinePlatform.addPool(ethers.BigNumber.from('0'), rewardRates[0], halvings[0])
  await tx.wait()
  return
  tx = await artOnlinePlatform.addToken('ARTX1000', ethers.BigNumber.from('400'))
    await tx.wait()
  tx = await artOnlinePlatform.addPool(ethers.BigNumber.from('1'), rewardRates[1], halvings[1])
  await tx.wait()
  tx = await artOnlinePlatform.addToken('ARTX2000', ethers.BigNumber.from('250'))
    await tx.wait()
  tx = await artOnlinePlatform.addPool(ethers.BigNumber.from('2'), rewardRates[2], halvings[2])
  await tx.wait()
  tx = await artOnlinePlatform.addToken('XTREME', ethers.BigNumber.from('133'))
    await tx.wait()
  tx = await artOnlinePlatform.addPool(ethers.BigNumber.from('3'), rewardRates[3], halvings[3])
  await tx.wait()
  tx = await artOnlinePlatform.addToken('MODULE', ethers.BigNumber.from('1000'))
    await tx.wait()
  tx = await artOnlinePlatform.addPool(ethers.BigNumber.from('4'), rewardRates[4], halvings[4])
  await tx.wait()
  tx = await artOnlinePlatform.list(ethers.BigNumber.from('0'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('153000', 18))
  await tx.wait()
  tx = await artOnlinePlatform.list(ethers.BigNumber.from('1'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('9600', 18))
  await tx.wait()
  tx = await artOnlinePlatform.list(ethers.BigNumber.from('2'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('25100', 18))
  await tx.wait()
  tx = await artOnlinePlatform.list(ethers.BigNumber.from('3'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('110000', 18))
  await tx.wait()
  tx = await artOnlinePlatform.list(ethers.BigNumber.from('4'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('2300', 18))
  await tx.wait()
})()
