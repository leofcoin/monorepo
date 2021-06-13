const ethers = require('ethers')
const Token = require('./build/contracts/Arteon.json')
const GenesisGPU = require('./build/contracts/ArteonGPUGenesis.json')
const GenesisPool = require('./build/contracts/ArteonPoolGenesis.json')

const provider = new ethers.providers.JsonRpcProvider('https://ropsten.infura.io/v3/1ca30fe698514cf19a5e3e5e5c8334a8', {
  chainId: 3
})

const signer = new ethers.Wallet('78e88fe3ac5d3fc58b4f6494b75748f944085c8f058878a9a9117df1640cdfb8', provider);

const token = new ethers.Contract(Token.networks[3].address, Token.abi, signer);
const genesisGpu = new ethers.Contract(GenesisGPU.networks[3].address, GenesisGPU.abi, signer);
const genesisPool = new ethers.Contract(GenesisPool.networks[3].address, GenesisPool.abi, signer);
(async () => {
    // let minter = await token.addMinter(signer.address)
    // await minter.wait()
    // minter = await token.addMinter(genesisPool.address)
    // await minter.wait()
  // let mint = await token.mint('0x4B6bC2D4B95AE7C0341D6C951A24e26b05b71039', ethers.utils.parseUnits('100000'))
  // mint = await mint.wait()

  let card = await genesisGpu.addCard(signer.address)
  await card.wait()

  let approve = await genesisGpu.setApprovalForAll(genesisPool.address, true)
  await approve.wait();
  let mining = await genesisPool.mine('1', {gasLimit: 400000})
  await mining.wait();

  setTimeout(async () => {
    let deactivated = await genesisPool.deactivate_gpu('1')
    deactivated = await deactivated.wait()

    let reward = await genesisPool.getReward({gasLimit: 800000});
    console.log(await reward.wait());
  }, 30000);
})()
