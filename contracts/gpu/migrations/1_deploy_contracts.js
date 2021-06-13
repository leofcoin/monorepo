const ArteonGPU = artifacts.require("ArteonGPU.sol");

module.exports = function(deployer) {
  deployer.deploy(ArteonGPU, 'https://nft.arteon.org/json/genesis.json', 50, 'GENESIS');
  deployer.deploy(ArteonGPU, 'https://nft.arteon.org/json/artx1000.json', 400, 'ARTX 1000');
  deployer.deploy(ArteonGPU, 'https://nft.arteon.org/json/artx2000.json', 152, 'ARTX 2000');
};
