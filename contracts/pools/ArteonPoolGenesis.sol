pragma solidity ^0.8.0;

import './../miner/ArteonMiner.sol';

contract ArteonPoolGenesis is ArteonMiner {
  constructor(address token, address gpu) ArteonMiner(token, gpu) { }
}
