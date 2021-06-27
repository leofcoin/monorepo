const ethers = require('ethers')
const Token = require('./build/contracts/Arteon.json')
const GenesisGPU = require('./build/contracts/ArteonGPUGenesis.json')
const GenesisPool = require('./build/contracts/ArteonPoolGenesis.json')
const ArteonExchange = require('./build/contracts/ArteonExchange.json')

const addresses = require('./addresses/addresses/ropsten.json')
const provider = new ethers.providers.JsonRpcProvider('https://ropsten.infura.io/v3/1ca30fe698514cf19a5e3e5e5c8334a8', {
  chainId: 3
})

const signer = new ethers.Wallet('78e88fe3ac5d3fc58b4f6494b75748f944085c8f058878a9a9117df1640cdfb8', provider);

const token = new ethers.Contract(addresses.token, Token.abi, signer);
const genesisGpu = new ethers.Contract(addresses.cards.genesis, GenesisGPU.abi, signer);
const artx1000Gpu = new ethers.Contract(addresses.cards.artx1000, GenesisGPU.abi, signer);
const artx2000Gpu = new ethers.Contract(addresses.cards.artx2000, GenesisGPU.abi, signer);
const genesisPool = new ethers.Contract(addresses.pools.genesis, GenesisPool.abi, signer);
const arteonExchange = new ethers.Contract(addresses.exchange, ArteonExchange.abi, signer);
(async () => {
    // let minter = await token.addMinter(signer.address)
    // await minter.wait()

    // token.mint(signer.address, ethers.utils.parseUnits('100000000'))
    let minter = await token.addMinter(genesisPool.address)
    const tx = await minter.wait()
return
    // let nonce = Number(minter.nonce)
    //
    // let promises = [
    //   token.addMinter(addresses.pools.artx1000, {nonce: nonce+=1}),
    //   token.addMinter(addresses.pools.artx2000, {nonce: nonce+=1})
    // ]
    //
    // promises = await Promise.all(promises)
    // promises = await Promise.all(promises.map(promise => promise.wait()))
    // console.log(promises);

  // // // // // // //
  // // let card = await genesisGpu.addCard(signer.address)
  // // await card.wait()
  // // // // // //
  let approve = await genesisGpu.setApprovalForAll(genesisPool.address, true)
  await approve.wait();
  // // // // // // //
  // // // console.log(genesisPool);
  // //
  // let mining = await genesisPool.activateGPU('14')
  // await mining.wait();
  // let totalSupply = await genesisPool.callStatic.totalSupply()
  // console.log(totalSupply);

  let mining = await genesisPool.activateGPU('11')
  await mining.wait();
  //

  setTimeout(async () => {
    let earned = await genesisPool.earned();
    console.log(await earned.wait());
  //

  let rewardPerGPU = await genesisPool.callStatic.rewardPerGPU()
  console.log(rewardPerGPU);

  earned = await genesisPool.callStatic.earned();
  console.log(earned);
    let getReward = await genesisPool.deactivateGPU('11');
    console.log(await getReward.wait());
  }, 120000);
})()
