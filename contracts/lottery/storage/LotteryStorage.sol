// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import './../../token/interfaces/IArtOnline.sol';
import './../interfaces/ILotteryTickets.sol';
import './../interfaces/IRandomNumberGenerator.sol';

contract LotteryStorage {
  address internal _manager;
  uint256 internal _lotteryIds;
  ILotteryTickets internal _lotteryTicketsNFT;
  IArtOnline internal _artOnline;
  IRandomNumberGenerator internal _randomNumberGenerator;
  uint256 public _lotterySize;
  uint256 public _maxValidRange;
  bytes32 internal _requestId;

  mapping(uint256 => lottoInfo) internal _lotteries;

  event ChangeManager(address previous, address current);
  event BuyTickets(address indexed owner, uint256 lotteryId, uint256[] numbers, uint256 totalCost);
  event RequestNumbers(uint256 lotteryId, bytes32 requestId);
  event LotteryClose(uint256 lotteryId);
  event LotteryOpen(uint256 lotteryId);
  event UpdateLotterySize(uint256 newLotterySize);
  event ChangeMaxRange(uint256 newMaxRange);

  enum Status {
    NotStarted,     // The lottery has not started yet
    Open,           // The lottery is open for ticket purchases
    Closed,         // The lottery is no longer open for ticket purchases
    Completed       // The lottery has been closed and the numbers drawn
  }
  struct lottoInfo {
    uint256 id;
    Status status;
    uint256 prizePool;
    uint256 ticketPrice;
    uint8[] prizeDistribution;
    uint256 startTime;
    uint256 endTime;
    uint256[] winningNumbers;
  }
}
