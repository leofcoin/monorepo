const ethers = require('ethers')
const addresses = require('./../addresses/addresses/binance-smartchain-testnet.json')
const ERC20 = require('./../build/contracts/ERC20.json')

const dotenv = require('dotenv').config()
const config = dotenv.parsed

const provider = new ethers.providers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545', {
  chainId: 97
})

const signer = new ethers.Wallet(config.TEST_PRIVATEKEY, provider);

const erc20 = new ethers.Contract('0x5a8809EF9ee3360bfF7EB83d769Ac5F7B28572E2', ERC20.abi, signer);

(async () => {
  let tx
  tx = await erc20.approve('0xD99D1c33F9fC3444f8101754aBC46c52416550D1', ethers.utils.parseUnits('10000', 18))
  await tx.wait()
  // tx = await mining.setActivationPrice(ethers.BigNumber.from('5'), ethers.utils.parseUnits('3500', 18))
  // await tx.wait()
  // tx = await platform.setArtOnline(addresses.artonline, {gasLimit: 210000}),
  // await tx.wait()
})()
