interface IArtOnlineLottery {
  function numbersDrawn(uint256 _lotteryId, bytes32 _requestId, uint256 _randomNumber) external;
}
