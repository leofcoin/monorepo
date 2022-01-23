// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import './../common/Initializable.sol';
import './interfaces/ILotteryTickets.sol';
import './interfaces/IRandomNumberGenerator.sol';
import './../token/interfaces/IArtOnline.sol';
import "./../../node_modules/@openzeppelin/contracts/utils/Address.sol";

contract ArtOnlineLottery is Initializable {
  using Address for address;
  address internal _manager;
  uint256 internal _lotteryIds;
  ILotteryTickets internal _lotteryTicketsNFT;
  IArtOnline internal _artOnline;
  IRandomNumberGenerator internal _randomNumberGenerator;
  uint256 internal _lotterySize;
  uint16 public _maxValidRange;
  bytes32 _requestId;

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
    uint16[] winningNumbers;
  }

  modifier onlyRandomGenerator() {
    require(msg.sender == address(_randomNumberGenerator), 'Only random generator');
    _;
  }


  modifier onlyManager() {
    require(msg.sender == _manager, 'ONLY_MANAGER');
    _;
  }

  modifier notContract() {
    require(!address(msg.sender).isContract(), 'CONTRACTS_NOT_ALLOWED');
    _;
  }

  function initialize() external initializer() {
    _manager = msg.sender;
  }

  function setRandomNumberGenerator(address randomNumberGenerator_) external onlyManager() {
    _randomNumberGenerator = IRandomNumberGenerator(randomNumberGenerator_);
  }

  function setMaxRange(uint16 maxRange_) external onlyManager() {
    _maxValidRange = maxRange_;
    emit ChangeMaxRange(maxRange_);
  }

  function maxRange() external view returns(uint16) {
    return _maxValidRange;
  }

  function changeLotteryTicketsNFT(address lotteryTicketsAddress_) external virtual onlyManager() {
    _lotteryTicketsNFT = ILotteryTickets(lotteryTicketsAddress_);
  }

  function changeArtOnline(address artOnline_) external virtual onlyManager() {
    _artOnline = IArtOnline(artOnline_);
  }

  function setLotterySize(uint256 lotterySize_) external onlyManager() {
    _lotterySize = lotterySize_;
  }

  function lotterySize() external view virtual returns (uint256) {
    return _lotterySize;
  }

  function changeManager(address manager_) external virtual onlyManager {
    emit ChangeManager(_manager, manager_);
    _manager = manager_;
  }

  function lotteries() external view returns (uint256) {
    return _lotteryIds;
  }

  function lottery(uint256 id_) external view returns (lottoInfo memory) {
    return _lotteries[id_];
  }

  function createLottery(uint256 duration_, uint256 endTime_, uint256 _prizePool, uint256 _costPerTicket, uint8[] calldata _prizeDistribution) external virtual onlyManager {
    uint256 startTime_ = endTime_ - duration_;

    _lotteryIds += 1;

    require(_prizeDistribution.length == _lotterySize, "Invalid distribution");

    uint256 prizeDistributionTotal = 0;
    for (uint256 i = 0; i < _prizeDistribution.length; i++) {
      prizeDistributionTotal += uint256(_prizeDistribution[i]);
    }

    // 20 percent hardcoded burn in contract
    require(prizeDistributionTotal == 80, "Prize distribution is not 80%");
    require(_prizePool != 0 && _costPerTicket != 0, "Prize or cost cannot be 0");
    require(startTime_ != 0 && startTime_ < endTime_, "Timestamps for lottery invalid");

    uint256 id_ = _lotteryIds;
     uint16[] memory _winningNumbers = new uint16[](_lotterySize);
    lottoInfo memory _lottery = lottoInfo(
      id_,
      Status.Open,
      _prizePool,
      _costPerTicket,
      _prizeDistribution,
      startTime_,
      endTime_,
      _winningNumbers
    );

    _lotteries[id_] = _lottery;

    emit LotteryOpen(id_);
  }

  function drawWinningNumbers(uint256 id_, uint256 seed_) external onlyManager {
    require(_lotteries[id_].endTime <= block.timestamp, 'LOTTERY_OPEN');
    require( _lotteries[id_].status == Status.Open, 'LOTTERY_STATE_ERROR');
    _lotteries[id_].status = Status.Closed;
    _requestId = _randomNumberGenerator.getRandomNumber(id_, seed_);
    emit RequestNumbers(id_, _requestId);
    // requestId_ = _callApi()

    // uint256 burnAmount_ = _lotteries[id_].prizePool - totalWinnings;
    // IArtOnline(_artOnline).burn(burnAmount_);
    //
    // for (uint256 i; i < winners.length; i++) {
    //   IArtOnline(_artOnline).transferFrom(address(this), winner, amount);
    // }

  }

  function numbersDrawn(uint256 _lotteryId, bytes32 requestId_, uint256 _randomNumber) external onlyRandomGenerator() {
     require(_lotteries[_lotteryId].status == Status.Closed, "Draw numbers first");
     if (_requestId == requestId_) {
       _lotteries[_lotteryId].status = Status.Completed;
       _lotteries[_lotteryId].winningNumbers = _split(_randomNumber);
     }
     uint256 burn = (_lotteries[_lotteryId].prizePool / 100) * 20;
     _lotteries[_lotteryId].prizePool -= burn;
     _artOnline.burnFrom(address(this), burn);
     emit LotteryClose(_lotteryId);
   }

  function buyTickets(uint256 id_, uint256 amount, uint256[] memory numbers_) external notContract() {
    require(_lotteries[id_].endTime < block.timestamp, 'LOTTERY_ENDED');
    require(_lotteries[id_].startTime > block.timestamp, 'LOTTERY_NOT_STARTED');

    _artOnline.safeTransferFrom(
      msg.sender,
      address(this),
      amount * _lotteries[id_].ticketPrice
    );

    _lotteryTicketsNFT.mintTickets(id_, msg.sender, amount, numbers_, _lotterySize);
    emit BuyTickets(msg.sender, id_, numbers_, amount * _lotteries[id_].ticketPrice);
  }

  function latestLottery() external view virtual returns (lottoInfo memory) {
    return _lotteries[_lotteryIds];
  }

  function _beforeClaim(uint256 _lotteryId) internal {
    require(_lotteries[_lotteryId].endTime <= block.timestamp, "Wait till end to claim");
    require(_lotteries[_lotteryId].status == Status.Completed, "Winning Numbers not chosen yet");
  }

  function claimReward(address receiver, uint256 _lotteryId, uint256 _tokenId) external notContract() {
     _beforeClaim(_lotteryId);
     address owner = _lotteryTicketsNFT.ownerOf(_lotteryId, _tokenId);
     require(owner == receiver, "Only the owner can claim");
     require(_lotteryTicketsNFT.claim(_lotteryId, _tokenId), "Numbers for ticket invalid");

     // Getting the number of matching tickets
     uint8 matchingNumbers = _getNumberOfMatching(
       _lotteryTicketsNFT.getTicketNumbers(_tokenId),
       _lotteries[_lotteryId].winningNumbers
     );
     // Getting the prize amount for those matching tickets
     uint256 prizeAmount = _prizeForMatching(
       matchingNumbers,
       _lotteryId
     );
     _lotteries[_lotteryId].prizePool -= prizeAmount;
     _artOnline.safeTransferFrom(address(this), address(receiver), prizeAmount);
   }

  function batchClaimRewards(address receiver, uint256 _lotteryId, uint256[] calldata _tokenIds) external notContract() {
    require(_tokenIds.length <= 50, "Batch claim too large");
    _beforeClaim(_lotteryId);

    uint256 totalPrize = 0;
    for (uint256 i = 0; i < _tokenIds.length; i++) {
      require(_lotteryTicketsNFT.ownerOf(_lotteryId, _tokenIds[i]) == receiver, "Only the owner can claim");
      if(!_lotteryTicketsNFT.claimed(_lotteryId, _tokenIds[i])) {
        require(_lotteryTicketsNFT.claim(_lotteryId, _tokenIds[i]), "Numbers for ticket invalid");
        uint8 matchingNumbers = _getNumberOfMatching(
          _lotteryTicketsNFT.getTicketNumbers(_tokenIds[i]),
          _lotteries[_lotteryId].winningNumbers
        );
        uint256 prizeAmount = _prizeForMatching(
          matchingNumbers,
          _lotteryId
        );
        unchecked {
          _lotteries[_lotteryId].prizePool -= prizeAmount;
          totalPrize += prizeAmount;
        }
      }
    }
    _artOnline.safeTransferFrom(address(this), address(receiver), totalPrize);
  }

  function _getNumberOfMatching(uint16[] memory _usersNumbers, uint16[] memory _winningNumbers) internal pure returns(uint8 noOfMatching) {
     // Loops through all wimming numbers
     for (uint256 i = 0; i < _winningNumbers.length; i++) {
       // If the winning numbers and user numbers match
       if(_usersNumbers[i] == _winningNumbers[i]) {
         // The number of matching numbers incrases
         noOfMatching += 1;
       }
     }
   }

 function _prizeForMatching(uint8 _noOfMatching, uint256 _lotteryId) internal view returns(uint256) {
    uint256 prize = 0;
    if(_noOfMatching == 0) {
      return 0;
    }
    uint256 perOfPool = _lotteries[_lotteryId].prizeDistribution[_noOfMatching-1];
    prize = _lotteries[_lotteryId].prizePool * perOfPool;
    return prize / 100;
  }

  function _split(uint256 _randomNumber) internal view returns(uint16[] memory) {
    uint16[] memory winningNumbers = new uint16[](_lotterySize);
    for(uint i = 0; i < _lotterySize; i++){
      // Encodes the random number with its position in loop
      bytes32 hashOfRandom = keccak256(abi.encodePacked(_randomNumber, i));
      // Casts random number hash into uint256
      uint256 numberRepresentation = uint256(hashOfRandom);
      // Sets the winning number position to a uint16 of random hash number
      winningNumbers[i] = uint16(numberRepresentation % _maxValidRange);
    }
    return winningNumbers;
  }

  function withdraw(uint256 amount_) external onlyManager() {
    _artOnline.safeTransferFrom(address(this), _manager, amount_);
  }
}
