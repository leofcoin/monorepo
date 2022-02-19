const BRIDGER_ABI = require('./../build/contracts/ArtOnlineBridger.json');
const PLATFORM_ABI = require('./../build/contracts/ArtOnlinePlatform.json');
const MINING_ABI = require('./../build/contracts/ArtOnlineMining.json');
const EXCHANGE_ABI = require('./../build/contracts/ArtOnlineExchange.json');
const STAKING_ABI = require('./../build/contracts/ArtOnlineStaking.json');
const ABI = require('./../build/contracts/ArtOnline.json');
const ethers = require('ethers')
const ora = require('ora');

let spinner = ora('Setting up new contracts').start();

const addresses = require('./../addresses/addresses/binance-smartchain-testnet.json')
const dotenv = require('dotenv').config()
const config = dotenv.parsed

const provider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545', {
  chainId: 97
})

const signer = new ethers.Wallet(config.TEST_PRIVATEKEY, provider);

const SixtySeconds = ethers.BigNumber.from('60')

const rewardRates = [
  ethers.utils.parseUnits(((153000 / 2.102e+7) * 50).toString(), 18),
  ethers.utils.parseUnits(((9600 / 3.154e+7) * 400).toString(), 18),
  ethers.utils.parseUnits(((25100 / 2.102e+7) * 250).toString(), 18),
  ethers.utils.parseUnits(((97000 / 2.102e+7) * 133).toString(), 18),
  ethers.utils.parseUnits(((2300 / 3.154e+7) * 1000).toString(), 18),
  ethers.BigNumber.from('1'),
  ethers.utils.parseUnits(((143000 / 2.102e+7) * 50).toString(), 18),
]

const halvings = [
  ethers.BigNumber.from('1170000'),
  ethers.BigNumber.from('1170000'),
  ethers.BigNumber.from('1170000'),
  ethers.BigNumber.from('1170000'),
  ethers.BigNumber.from('1170000'),
  ethers.BigNumber.from('2340000'),
  ethers.BigNumber.from('1700000'),
];

(async () => {

    const MINT_ROLE = '0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686'
    const artOnlineBridger = await new ethers.Contract(addresses.bridger, BRIDGER_ABI.abi, signer)
    const artOnlinePlatform = await new ethers.Contract(addresses.platform, PLATFORM_ABI.abi, signer)
    const artOnlineMining = await new ethers.Contract(addresses.mining, MINING_ABI.abi, signer)
    const artOnlineExchange = await new ethers.Contract(addresses.exchange, EXCHANGE_ABI.abi, signer)
    const artOnlineStaking = await new ethers.Contract(addresses.staking, STAKING_ABI.abi, signer)
    const artOnline = await new ethers.Contract(addresses.artonline, ABI.abi, signer)
    // let tx = await artOnline.approve(artOnlineStaking.address, ethers.utils.parseUnits('100'))
    // await tx.wait()

    // let tx = await artOnline.mint(signer.address, ethers.utils.parseUnits('10000'))
    // tx = await tx.wait()
    let tx = await artOnline.increaseAllowance(addresses.artonline, ethers.utils.parseUnits('100'), {gasLimit: 210000})
    tx = await tx.wait()
try {
  tx = await artOnlineStaking.stake(signer.address, ethers.utils.parseUnits('100'), {gasLimit: 210000})
  tx = await tx.wait()
} catch (e) {
  console.error(e);
}
// console.log(tx);
return
    // bridger.setArtOnlineAccess(addresses.access)
    await artOnlineBridger.setArtOnline(addresses.artonline)
    await artOnlineBridger.setArtOnlinePlatform(addresses.platform)
    await artOnlineBridger.setArtOnlineMining(addresses.mining)
    await artOnlineBridger.setArtOnlineBlacklist(addresses.blacklist)
    await artOnlineBridger.setArtOnlineExchange(addresses.exchange)
    await artOnlineBridger.setArtOnlineStaking(addresses.staking)

    spinner.succeed('Bridger updated')
    spinner.start('Set bridgerInterfaces')
    await artOnlinePlatform.setArtOnlineBridgerInterface(addresses.bridger);
    await artOnlineMining.setArtOnlineBridgerInterface(addresses.bridger);
    await artOnlineStaking.setArtOnlineBridgerInterface(addresses.bridger);

    spinner.succeed()
    spinner.start('Add Tokens')

    await artOnlinePlatform.addToken('GENESIS', ethers.BigNumber.from('50'))
    await artOnlinePlatform.addToken('ARTX1000', ethers.BigNumber.from('400'))
    await artOnlinePlatform.addToken('ARTX2000', ethers.BigNumber.from('250'))
    await artOnlinePlatform.addToken('XTREME', ethers.BigNumber.from('133'))
    await artOnlinePlatform.addToken('MODULE', ethers.BigNumber.from('1000'))
    await artOnlinePlatform.addToken('SPINNER', ethers.BigNumber.from('500'))
    await artOnlinePlatform.addToken('GOLDGEN', ethers.BigNumber.from('50'))

    spinner.succeed()
    spinner.start('Add Pools')
    await artOnlineMining.addPool('GENESIS', ethers.BigNumber.from('0'), rewardRates[0], halvings[0], addresses.artonline)
    await artOnlineMining.addPool('ARTX1000', ethers.BigNumber.from('1'), rewardRates[1], halvings[1], addresses.artonline)
    await artOnlineMining.addPool('ARTX2000', ethers.BigNumber.from('2'), rewardRates[2], halvings[2], addresses.artonline)
    await artOnlineMining.addPool('XTREME', ethers.BigNumber.from('3'), rewardRates[3], halvings[3], addresses.artonline)
    await artOnlineMining.addPool('MODULE', ethers.BigNumber.from('4'), rewardRates[4], halvings[4], addresses.artonline)

    await artOnlineMining.addItem('SPINNER', ethers.BigNumber.from('5'), rewardRates[5], halvings[5], addresses.artonline)

    await artOnlineMining.addPool('GOLDGEN', ethers.BigNumber.from('6'), rewardRates[6], halvings[6], addresses.artonline)

    await artOnlineMining.setActivationPrice(ethers.BigNumber.from('5'), ethers.utils.parseUnits('3500', 18))
    spinner.succeed()
    spinner.start('List gpus')
    await artOnlineExchange.list(ethers.BigNumber.from('0'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('153000', 18))
    await artOnlineExchange.list(ethers.BigNumber.from('1'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('9600', 18))
    await artOnlineExchange.list(ethers.BigNumber.from('2'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('50500', 18))
    await artOnlineExchange.list(ethers.BigNumber.from('3'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('110000', 18))
    await artOnlineExchange.list(ethers.BigNumber.from('4'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('7000', 18))

    await artOnlineExchange.list(ethers.BigNumber.from('5'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('10000', 18))
    await artOnlineExchange.list(ethers.BigNumber.from('6'), ethers.BigNumber.from('0'), ethers.utils.parseUnits('320000', 18))
    spinner.succeed()
    // await artOnlinePlatform.grantRole(MINT_ROLE, artOnlinePlatform.address)

    // await updateContract('artonline', `abis/artonline.js`, artOnline)

    // await deployer.deploy(Crowdsale, '43478', '0xF52D485Eceba4049e92b66df0Ce60fE19589a0C1', artOnline.address)
    // const presale = await Crowdsale.deployed()

    // await artOnline.grantRole(MINT_ROLE, presale.address)

})();
