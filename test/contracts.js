const ethers = require('ethers')
const json = require('./../build/contracts/ArteonL1L2.json');
const _arteon = require('./../build/contracts/ArteonERC20.json');
const rootjson = require('./../build/contracts/ArteonV2RootTunnel.json');
const childjson = require('./../build/contracts/ArteonV2ChildTunnel.json');
const addresses = require('./../addresses/addresses/binance-smartchain-testnet.json')
const ARTEON_ABI = require('./../build/contracts/ArtOnline.json')
const PLATFORM_ABI = require('./../build/contracts/ArtOnlinePlatform.json')
const FACTORY = require('./../build/contracts/ArteonPoolFactory.json')
const MINER = require('./../build/contracts/ArteonMiner.json')
const GPU = require('./../build/contracts/ArteonGPU.json')
const Crowdsale = require('./../build/contracts/Crowdsale.json')

const holders = require('./../snapshots/snapshot.holders.json')
let balances = require('./../snapshots/snapshot.balances.json')
const dotenv = require('dotenv').config()
const config = dotenv.parsed

const MINT_ROLE = '0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686'

// const addresses = require('./addresses/addresses/ropsten.json')
const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org', {
  chainId: 56
})

const mainProvider = new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/1ca30fe698514cf19a5e3e5e5c8334a8', {
  chainId: 1
})

const signer = new ethers.Wallet(config.MAIN_PRIVATEKEY, provider);
const buyerSigner = new ethers.Wallet('32f965dadd6c72b602dfec799767e10856037aa68666e931bfb4ba74b21c3edd', provider);

const erc20Address = addresses.artonline
const erc1155Address = addresses.platform


const arteon = new ethers.Contract(erc20Address, ARTEON_ABI.abi, buyerSigner);
const arteonSigner = new ethers.Contract(erc20Address, ARTEON_ABI.abi, signer);

const contract = new ethers.Contract(erc1155Address, PLATFORM_ABI.abi, signer);
const buyerContract = new ethers.Contract(erc1155Address, PLATFORM_ABI.abi, buyerSigner);

const factory = new ethers.Contract('0xcD83cf04Db8989fF54F208Bec3Bc3203431648a2', FACTORY.abi, mainProvider);
const sale = new ethers.Contract('0xf52E774d2677a59E37A30a7F8340a98733C4128C', Crowdsale.abi, signer);

(async () => {
  // arteonSigner.grantRole(MINT_ROLE, '0xf52E774d2677a59E37A30a7F8340a98733C4128C')
  // return
  let mint = await arteonSigner.mint('0xD0A18Fd109F116c7bdb431d07aD6722d5A59F449', ethers.utils.parseUnits('1000000', 18), {gasLimit: 200000})
  await mint.wait()

  return
  sale.buyTokens('0xD744F4A2FBb5474Ab73C011AC9F02e32dC81f56f', {value: ethers.utils.parseUnits('0.000023'), gasLimit: 210000})


  try {
    let addToken = await contract.addToken('GENESIS', ethers.BigNumber.from('0'), ethers.BigNumber.from('50'), {gasLimit: 200000})
    await addToken.wait()
    // addToken = await contract.addToken('GENESIS', ethers.BigNumber.from('0'), ethers.BigNumber.from('50'), {gasLimit: 200000})
    // await addToken.wait()
  } catch (e) {
    console.log(e);
  }
  return
  mint = await arteonSigner.mint('0xEA232e36f8243f23b4f0f6Ac5a2ECc64AC1024A3', ethers.utils.parseUnits('10000', 18), {gasLimit: 200000})
  await mint.wait()

  mint = await contract.mint('0xD744F4A2FBb5474Ab73C011AC9F02e32dC81f56f', ethers.BigNumber.from('0'), ethers.BigNumber.from('1'), {gasLimit: 200000})
  await mint.wait()

  let list = await contract.list(ethers.BigNumber.from('0'), ethers.BigNumber.from('1'), ethers.utils.parseUnits('100', 18), {gasLimit: 200000})
  await list.wait()

  let approved = await arteon.callStatic.allowance('0xEA232e36f8243f23b4f0f6Ac5a2ECc64AC1024A3', contract.address)
  console.log(approved);
  if (approved.lt(100)) {
    console.log('(a)');
    let approval = await arteon.increaseAllowance(contract.address, ethers.utils.parseUnits('100', 18), { gasLimit: 200000})
    await approval.wait()
  }

  console.log(await contract.callStatic.ownerOf(ethers.BigNumber.from('0'), ethers.BigNumber.from('1')));

  const balance = await arteon.callStatic.balanceOf('0xEA232e36f8243f23b4f0f6Ac5a2ECc64AC1024A3')
  console.log(`buyer balance ${ethers.utils.formatUnits(balance, 18)}`);
  const price = await buyerContract.callStatic.getPrice(ethers.BigNumber.from('0'), ethers.BigNumber.from('1'))
  console.log(`price ${ethers.utils.formatUnits(price, 18)}`);
  let buy = await buyerContract.buy(ethers.BigNumber.from('0'), ethers.BigNumber.from('1'), {gasLimit: 280000})
  await buy.wait()
  console.log('bought');
  let activateGPU = await buyerContract.activateGPU(ethers.BigNumber.from('0'), ethers.BigNumber.from('1'), {gasLimit: 280000})
  await activateGPU.wait()
  console.log('activated');
  // const maxSupply = await buyerContract.callStatic.maxSupply(ethers.BigNumber.from('0'))
  // console.log(ethers.utils.formatUnits(maxSupply, 18));
  return setTimeout(async () => {
    let earned = await buyerContract.callStatic.earned(ethers.BigNumber.from('1'), {gasLimit: 200000})

    console.log(ethers.utils.formatUnits(earned, 18));
  // return
    let getReward = await buyerContract.callStatic.getReward(ethers.BigNumber.from('0'), {gasLimit: 200000})

    console.log(getReward);
    console.log(`reward: ${ethers.utils.formatUnits(getReward, 18)}`);
  }, 70000);
})()
