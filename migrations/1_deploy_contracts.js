const Arteon = artifacts.require("./contracts/token/Arteon.sol");

const ArteonGPUGenesis = artifacts.require("./contracts/gpus/ArteonGPUGenesis.sol");
const ArteonGPUARTX1000 = artifacts.require("./contracts/gpus/ArteonGPUARTX1000.sol");
const ArteonGPUARTX2000 = artifacts.require("./contracts/gpus/ArteonGPUARTX2000.sol");

const ArteonPoolGenesis = artifacts.require("./contracts/pools/ArteonPoolGenesis.sol");
const ArteonPoolARTX1000 = artifacts.require("./contracts/pools/ArteonPoolARTX1000.sol");
const ArteonPoolARTX2000 = artifacts.require("./contracts/pools/ArteonPoolARTX2000.sol");
const ArteonExchange = artifacts.require("./contracts/exchange/ArteonExchange.sol");

module.exports = async deployer => {
  await deployer.deploy(Arteon, 'Arteon', 'ART', {overwrite: false});
  const token = await Arteon.deployed()

  await deployer.deploy(ArteonGPUGenesis, { overwrite: false });
  const Genesis = await ArteonGPUGenesis.deployed()
  await deployer.deploy(ArteonGPUARTX1000, { overwrite: false });
  const ARTX1000 = await ArteonGPUARTX1000.deployed()
  await deployer.deploy(ArteonGPUARTX2000, { overwrite: false });
  const ARTX2000 = await ArteonGPUARTX2000.deployed()

  await deployer.deploy(ArteonPoolGenesis, token.address, Genesis.address, { overwrite: false });
  const GenesisPool = await ArteonPoolGenesis.deployed();
  await deployer.deploy(ArteonPoolARTX1000, token.address, ARTX1000.address, { overwrite: false });
  const ARTX1000Pool = await ArteonPoolARTX1000.deployed();
  await deployer.deploy(ArteonPoolARTX2000, token.address, ARTX2000.address, { overwrite: false });
  const ARTX2000Pool = await ArteonPoolARTX2000.deployed();

  await deployer.deploy(ArteonExchange, token.address);
  const arteonExchange = await ArteonExchange.deployed();

  console.log({
    token: token.address,
    exchange: arteonExchange.address,
    pools: {
      genesis: GenesisPool.address,
      artx1000: ARTX1000Pool.address,
      artx2000: ARTX2000Pool.address
    },
    gpus: {
      genesis: Genesis.address,
      artx1000: ARTX2000.address,
      artx2000: ARTX2000.address
    }
  });
};
