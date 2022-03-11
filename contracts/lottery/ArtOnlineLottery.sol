// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import './../common/Initializable.sol';
import "./../../node_modules/@openzeppelin/contracts/utils/Address.sol";
import './storage/LotteryStorage.sol';

contract ArtOnlineLottery is Initializable, LotteryStorage {
  using Address for address;

  modifier onlyManager() {
    require(msg.sender == _manager, 'ONLY_MANAGER');
    _;
  }

  modifier notContract() {
    require(!address(msg.sender).isContract(), 'CONTRACTS_NOT_ALLOWED');
    _;
  }

  function initialize() external initializer {
    emit ChangeManager(_manager, msg.sender);
    _manager = msg.sender;
  }

  function setMaxRange(uint256 maxRange_) external onlyManager {
    _maxValidRange = maxRange_;
    emit ChangeMaxRange(maxRange_);
  }

  function maxRange() external view returns(uint256) {
    return _maxValidRange;
  }

  function changeLotteryTicketsNFT(address lotteryTicketsAddress_) external virtual onlyManager {
    _lotteryTicketsNFT = ILotteryTickets(lotteryTicketsAddress_);
  }

  function changeArtOnline(address artOnline_) external virtual onlyManager {
    _artOnline = IArtOnline(artOnline_);
  }

  function setLotterySize(uint256 lotterySize_) external onlyManager {
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

  function topUp(uint256 amount) external {
    _artOnline.transferFrom(
      msg.sender,
      address(this),
      amount
    );
    _lotteries[_lotteryIds].prizePool += amount;
  }

  function createLottery(uint256 startTime_, uint256 endTime_, uint256 _costPerTicket, uint256[] calldata _prizeDistribution) external virtual onlyManager {
    uint256 _prizePool = _artOnline.balanceOf(address(this));
    _lotteryIds += 1;

    require(_prizePool != 0 && _costPerTicket != 0, "Prize or cost cannot be 0");
    require(startTime_ != 0 && startTime_ < endTime_, "Timestamps for lottery invalid");
    require(_prizeDistribution.length == _lotterySize, "Invalid distribution");

    uint256 prizeDistributionTotal = 0;
    for (uint256 i = 0; i < _prizeDistribution.length; i++) {
      prizeDistributionTotal += uint256(_prizeDistribution[i]);
    }
    require(prizeDistributionTotal == 100, "Prize distribution is not 100%");

    uint256 id_ = _lotteryIds;
    uint256[] memory _winningNumbers = new uint256[](_lotterySize);
    uint256[] memory _totalMatches = new uint256[](_lotterySize);

    lottoInfo memory _lottery = lottoInfo(
      id_,
      Status.Open,
      _prizePool,
      _costPerTicket,
      _prizeDistribution,
      _totalMatches,
      startTime_,
      endTime_,
      _winningNumbers,
      '0x0'
    );

    _lotteries[id_] = _lottery;

    emit LotteryOpen(id_);
  }

  function revealWinningNumbers(uint256 lottery_, uint256[] memory winningNumbers_, uint256[] memory totalMatches_, string memory proof) external onlyManager {
    require(_lotteries[lottery_].endTime <= block.timestamp, 'LOTTERY_OPEN');
    require( _lotteries[lottery_].status == Status.Open, 'LOTTERY_STATE_ERROR');
    // require(_lotteries[lottery_].endTime + 60 <= block.timestamp, 'LOTTERY_END_DELAY');

    uint256[] memory _winningNumbers = new uint256[](_lotterySize);
    for (uint256 i = 0; i < winningNumbers_.length; i++) {
      _winningNumbers[i] = uint256(winningNumbers_[i] % _maxValidRange);
    }

    _lotteries[lottery_].winningNumbers = _winningNumbers;
    _lotteries[lottery_].proof = proof;
    _lotteries[lottery_].status = Status.Completed;
    _lotteries[lottery_].totalMatches = totalMatches_;

    _artOnline.burn(address(this), _burns[lottery_]);

    emit LotteryClose(lottery_, _winningNumbers, _burns[lottery_]);
  }

  function buyTickets(uint256 id_, uint256 tickets, uint256[] memory numbers_) external notContract() {
    require(block.timestamp < _lotteries[id_].endTime, 'LOTTERY_ENDED');
    require(block.timestamp > _lotteries[id_].startTime, 'LOTTERY_NOT_STARTED');
    uint256 amount = tickets * _lotteries[id_].ticketPrice;

    _artOnline.transferFrom(
      msg.sender,
      address(this),
      amount
    );

    uint256 burnAmount_ = amount * 2 / 100;
    _lotteries[id_].prizePool += amount - burnAmount_;
    _burns[id_] += burnAmount_;
    _lotteryTicketsNFT.mintTickets(id_, msg.sender, tickets, numbers_, _lotterySize);
    emit BuyTickets(msg.sender, id_, numbers_, tickets);
  }

  function latestLottery() external view virtual returns (lottoInfo memory) {
    return (_lotteries[_lotteryIds]);
  }

  function timestamp() external view virtual returns (uint256) {
    return block.timestamp;
  }

  function _beforeClaim(uint256 _lotteryId) internal {
    require(_lotteries[_lotteryId].endTime <= block.timestamp, "Wait till end to claim");
    require(_lotteries[_lotteryId].status == Status.Completed, "Winning Numbers not chosen yet");
  }

  function claimReward(address receiver, uint256 _lotteryId, uint256 _tokenId) external notContract() {
     _beforeClaim(_lotteryId);
     address owner = _lotteryTicketsNFT.ownerOf(_lotteryId, _tokenId);
     require(owner == receiver, "Only the owner can claim");
     require(_lotteryTicketsNFT.claim(_lotteryId, _tokenId, _maxValidRange), "Numbers for ticket invalid");

     // Getting the number of matching tickets
     uint256 matchingNumbers = _getNumberOfMatching(
       _lotteryTicketsNFT.getTicketNumbers(_lotteryId, _tokenId),
       _lotteries[_lotteryId].winningNumbers
     );
     // Getting the prize amount for those matching tickets
     uint256 prizeAmount = _prizeForMatching(
       matchingNumbers,
       _lotteryId
     );
     _lotteries[_lotteryId].prizePool -= prizeAmount;
     _artOnline.transfer(address(receiver), prizeAmount);
   }

  function batchClaimRewards(address receiver, uint256 _lotteryId, uint256[] calldata _tokenIds) external notContract() {
    require(_tokenIds.length <= 50, "Batch claim too large");
    _beforeClaim(_lotteryId);

    uint256 totalPrize = 0;
    for (uint256 i = 0; i < _tokenIds.length; i++) {
      require(_lotteryTicketsNFT.ownerOf(_lotteryId, _tokenIds[i]) == receiver, "Only the owner can claim");
      if(!_lotteryTicketsNFT.claimed(_lotteryId, _tokenIds[i])) {
        require(_lotteryTicketsNFT.claim(_lotteryId, _tokenIds[i], _maxValidRange), "Numbers for ticket invalid");
        uint256 matchingNumbers = _getNumberOfMatching(
          _lotteryTicketsNFT.getTicketNumbers(_lotteryId, _tokenIds[i]),
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
    _artOnline.transfer(address(receiver), totalPrize);
  }

  function _getNumberOfMatching(uint256[] memory _usersNumbers, uint256[] memory _winningNumbers) internal pure returns(uint256 noOfMatching) {
     for (uint256 i = 0; i < _winningNumbers.length; i++) {
       if(_usersNumbers[i] == _winningNumbers[i]) {
         noOfMatching += 1;
       }
     }
     return noOfMatching;
   }

 function _prizeForMatching(uint256 _noOfMatching, uint256 _lotteryId) internal view returns(uint256) {
    uint256 prize = 0;
    if(_noOfMatching == 0) {
      return 0;
    }
    uint256 perOfPool = _lotteries[_lotteryId].prizeDistribution[_noOfMatching-1];
    uint256 totalMatches = _lotteries[_lotteryId].totalMatches[_noOfMatching-1];
    prize = _lotteries[_lotteryId].prizePool * perOfPool / totalMatches;
    return prize / 100;
  }

  function withdraw(uint256 amount_) external onlyManager {
    _artOnline.transferFrom(address(this), _manager, amount_);
  }
}
