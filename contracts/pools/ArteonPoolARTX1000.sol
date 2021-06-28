pragma solidity ^0.8.0;

import './../miner/ArteonMiner.sol';

contract ArteonPoolARTX1000 is ArteonMiner {
  constructor(address token, address gpu, uint256 blockTime, uint256 maxReward, uint256 halving)
    ArteonMiner(token, gpu, blockTime, maxReward, halving) { }
}
