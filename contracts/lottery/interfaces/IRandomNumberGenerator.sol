//SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface IRandomNumberGenerator {
  function getRandomNumber(uint256 lotteryId, uint256 userProvidedSeed) external returns (bytes32 requestId);
}
