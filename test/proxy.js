const ethers = require('ethers')
const addresses = require('./../addresses/addresses/binance-smartchain-testnet.json')
const ARTEON_ABI = require('./../build/contracts/ArtOnline.json')
const PLATFORM_ABI = require('./../build/contracts/ArtOnlinePlatform.json')

const dotenv = require('dotenv').config()
const config = dotenv.parsed

// const addresses = require('./addresses/addresses/ropsten.json')
const provider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545', {
  chainId: 97
})

const signer = new ethers.Wallet(config.TEST_PRIVATEKEY, provider);


const platformProxy = new ethers.Contract(addresses.platformProxy, PLATFORM_ABI.abi, signer);
const platform = new ethers.Contract(addresses.platform, PLATFORM_ABI.abi, signer);

(async () => {
  // arteonSigner.grantRole(MINT_ROLE, '0xf52E774d2677a59E37A30a7F8340a98733C4128C')
  // return
  // let mint = await arteonSigner.mint('0xD0A18Fd109F116c7bdb431d07aD6722d5A59F449', ethers.utils.parseUnits('11739060', 18), {gasLimit: 200000})
  // await mint.wait()

  // return
  // sale.buyTokens('0xD744F4A2FBb5474Ab73C011AC9F02e32dC81f56f', {value: ethers.utils.parseUnits('0.000023'), gasLimit: 210000})
  // await platform.grantRole('0x0000000000000000000000000000000000000000000000000000000000000000', signer.address)
  // await platformProxy.grantRole('0x0000000000000000000000000000000000000000000000000000000000000000', signer.address)
  try {
    // let addToken = await platformProxy.addToken('GENESIS', ethers.BigNumber.from('0'), ethers.BigNumber.from('50'), {gasLimit: 200000})
    // await addToken.wait()

    const cap = await platform.cap('0')
    console.log(cap.toString());
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
