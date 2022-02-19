// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import "./interfaces/IArtOnlineLottery.sol";

contract RandomNumberGenerator is VRFConsumerBase {

    bytes32 internal keyHash;
    uint256 internal fee;
    uint256 public randomResult;
    uint256 public currentLotteryId;

    address internal _lottery;

    modifier onlyLottery() {
      require(msg.sender == _lottery, "Only Lottery can call function");
      _;
    }

    constructor(address _vrfCoordinator, address _linkToken, address lottery_, bytes32 _keyHash, uint256 _fee) VRFConsumerBase(_vrfCoordinator, _linkToken) public {
      keyHash = _keyHash;
      fee = _fee;
      _lottery = lottery_;
    }

    /**
     * Requests randomness from a user-provided seed
     */
    function getRandomNumber(uint256 lotteryId) public onlyLottery() returns (bytes32 requestId) {
      require(keyHash != bytes32(0), "Must have valid key hash");
      require(LINK.balanceOf(address(this)) >= fee, "Not enough LINK - fill contract with faucet");
      currentLotteryId = lotteryId;
      return requestRandomness(keyHash, fee);
    }

    /**
     * Callback function used by VRF Coordinator
     */
    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
      IArtOnlineLottery(_lottery).numbersDrawn(
        currentLotteryId,
        requestId,
        randomness
      );
      randomResult = randomness;
    }
}
