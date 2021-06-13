const ArteonMiner = artifacts.require("ArteonMiner.sol");


module.exports = function(deployer) {
  deployer.deploy(ArteonMiner, '0x25c26fFa9eBc00f87033f7A8fEE78EbB1f17d27C', '0x1E425559252F8C93565577147F625fF3fdCADDF7');
  deployer.deploy(ArteonMiner, '0x25c26fFa9eBc00f87033f7A8fEE78EbB1f17d27C', '0x487A3027EE67b8b1E0Abb74A025F6e1c96cbDa66');
  deployer.deploy(ArteonMiner, '0x25c26fFa9eBc00f87033f7A8fEE78EbB1f17d27C', '0x6891Ab936a6029b334ec573Bc61742532d8b3f7C');
};
