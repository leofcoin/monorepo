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
  uint16 public _lotterySize;
  uint16 public _maxValidRange;

  mapping(uint256 => lottoInfo) internal _lotteries;
  mapping(uint256 => uint256) internal _burns;
  mapping(uint256 => uint16[]) internal _winningNumbers;

  event ChangeManager(address previous, address current);
  event BuyTickets(address indexed owner, uint256 lotteryId, uint16[] numbers, uint256 totalCost);
  event LotteryClose(uint256 lotteryId, uint16[] winningNumbers, uint256 burns);
  event LotteryOpen(uint256 lotteryId);
  event UpdateLotterySize(uint16 newLotterySize);
  event ChangeMaxRange(uint16 newMaxRange);

  enum Status {
    NotStarted,     // The lottery has not started yet
    Open,           // The lottery is open for ticket purchases
    Completed       // The lottery has been closed and the numbers drawn
  }
  struct lottoInfo {
    uint256 id;
    Status status;
    uint256 prizePool;
    uint256 ticketPrice;
    uint16[] prizeDistribution;
    uint16[] totalMatches;
    uint256 startTime;
    uint256 endTime;
    uint16[] winningNumbers;
    string proof;
  }
}
