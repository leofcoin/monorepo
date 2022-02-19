const ethers = require('ethers')
const holders = require('./../snapshots/snapshot.holders.json')
const balances = require('./../snapshots/snapshot.balances.json')
const PLATFORM_ABI = require('./../build/contracts/ArtOnlinePlatform.json').abi
const MINER_ABI = require('./../build/contracts/ArteonMiner.json').abi
const GPU_ABI = require('./../build/contracts/ArteonGPU.json').abi
const FACTORY_ABI = require('./../build/contracts/ArteonPoolFactory.json').abi
const addresses = require('./../addresses/addresses/binance-smartchain.json')
const dotenv = require('dotenv').config()
const {writeFile} = require('fs')
const {promisify} = require('util')
const {join} = require('path');
const blacklist = require('./blacklist.json')
const config = dotenv.parsed

const write = promisify(writeFile)

const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed1.ninicoin.io', {
  chainId: 56
})

const mainProvider = new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/1ca30fe698514cf19a5e3e5e5c8334a8', {
  chainId: 1
})

const signer = new ethers.Wallet(config.MAIN_PRIVATEKEY, provider);

const platformSigner = new ethers.Contract(addresses.artonline, PLATFORM_ABI, signer);

const factory = new ethers.Contract('0xcD83cf04Db8989fF54F208Bec3Bc3203431648a2', FACTORY_ABI, mainProvider);

const maxSupply = {
  '0x46E8E530Dd43ceD13EC00b32D9741CF254979BAe': 50,
  '0xfbB081f6Ad77584A4b2561A3683709068D950A46': 400,
  '0x915740E33F6283fb91C7401321390a4Fb4bf18E1': 250,
  '0x328c30A900f961e76f4072f08DAd07e5E5157119': 133
}

const _nftHolders = {
  '0x46E8E530Dd43ceD13EC00b32D9741CF254979BAe': [],
  '0xfbB081f6Ad77584A4b2561A3683709068D950A46': [],
  '0x915740E33F6283fb91C7401321390a4Fb4bf18E1': [],
  '0x328c30A900f961e76f4072f08DAd07e5E5157119': []
};

(async () => {
  // safetye mechanism
  // return console.log('already dropped');

  const getHoldings = async addr => {
    let promises = []
    const miner = new ethers.Contract(addr, MINER_ABI, mainProvider);
    const gpuAddress = await miner.callStatic.ARTEON_GPU()
    const gpu = new ethers.Contract(gpuAddress, GPU_ABI, mainProvider);
    for (let i = 1; i <= maxSupply[addr]; i++) {
      try {
        const owner = await miner.callStatic.ownerOf(i)
        _nftHolders[addr].push({address: owner, id: i})
      } catch (e) {
        try {
          const _holder = await gpu.callStatic.ownerOf(i)
          _nftHolders[addr].push({address: _holder, id: i})
        } catch (e) {
          console.log('not minted');
        }

      }
    }
  }

  let promises = []
  let index = await factory.callStatic.tokens()
  index = index.toNumber()
  for (var i = 0; i < index; i++) {
    promises.push(factory.listedTokens(i))
  }


  const tokens = await Promise.all(promises)
  promises = []
  for (const addr of tokens) {
    console.log({addr});
    await getHoldings(addr)

    _nftHolders[addr] = _nftHolders[addr].filter(holder => {
      return blacklist.indexOf(holder.address) === -1 ? holder : false
    })
  }



  await write(join(__dirname, 'nft-holders.json'), JSON.stringify(_nftHolders, null, '\t'))
})()
