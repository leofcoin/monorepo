const EXCHANGE_FACTORY_ABI = require('./../build/contracts/ArtOnlineExchangeFactory.json');
const SPLITTER_ABI = require('./../build/contracts/ArtOnlineSplitter.json');

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
  ethers.utils.parseUnits(((128000 / 1.577e+7) * 45).toString(), 18),
  ethers.utils.parseUnits(((68700 / 1.577e+7) * 100).toString(), 18), // shiboki
]

const halvings = [
  ethers.BigNumber.from(3.154e+7),
  ethers.BigNumber.from(3.154e+7),
  ethers.BigNumber.from(3.154e+7),
  ethers.BigNumber.from(3.154e+7),
  ethers.BigNumber.from(3.154e+7),
  ethers.BigNumber.from(9.461e+7),
  ethers.BigNumber.from(3.154e+7),
  ethers.BigNumber.from(3.154e+7), // shiboki
];

(async () => {
console.log(addresses);
    const artOnlineExchangeFactory = await new ethers.Contract(addresses.exchangeFactory, EXCHANGE_FACTORY_ABI.abi, signer)
    const shibokiSplitter = await new ethers.Contract(addresses.splitter, SPLITTER_ABI.abi, signer)

    let tx
    await artOnlineExchangeFactory.setSplitter('0xAe6A0f74206C594dc2d4DBA5c7F639316fDdB39b', addresses.splitter)
    spinner.succeed()
    // await artOnlinePlatform.grantRole(MINT_ROLE, artOnlinePlatform.address)

    // await updateContract('artonline', `abis/artonline.js`, artOnline)

    // await deployer.deploy(Crowdsale, '43478', '0xF52D485Eceba4049e92b66df0Ce60fE19589a0C1', artOnline.address)
    // const presale = await Crowdsale.deployed()

    // await artOnline.grantRole(MINT_ROLE, presale.address)

})();
