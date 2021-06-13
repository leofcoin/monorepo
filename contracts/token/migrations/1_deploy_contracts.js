const ARTEON = artifacts.require("Arteon.sol");


module.exports = function(deployer) {
  deployer.deploy(ARTEON, 'Arteon', 'ART');
};
