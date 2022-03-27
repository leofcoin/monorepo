// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import './../../node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol';

contract LotteryTickets is ERC1155 {
  address internal _lotteryContract;
  address internal _manager;
  mapping(bytes32 => address) internal _roles;
  mapping (address => mapping (uint256 => uint256[])) internal _userTickets;
  mapping (uint256 => uint256) internal _totalSupply;
  mapping (uint256 => mapping(uint256 => TicketInfo)) internal _ticketInfo;

  struct TicketInfo {
    address owner;
    uint16[] numbers;
    uint256 claimed;
    uint256 lotteryId;
  }

  event ManagerChanged(address previous, address current);
  event LotteryChanged(address previous, address current);

  modifier onlyManager() {
    require(_manager == msg.sender, 'NOT_MANAGER');
    _;
  }

  modifier onlyLottery() {
    require(_lotteryContract == msg.sender, 'NOT_LOTTERY');
    _;
  }

  constructor(string memory uri_) ERC1155(uri_) {
    _manager = msg.sender;
  }

  function setLotteryContract(address _contract) external virtual onlyManager() {
    emit LotteryChanged(_lotteryContract, _contract);
    _lotteryContract = _contract;
  }

  function setManager(address manager_) external virtual onlyManager() {
    emit ManagerChanged(_manager, manager_);
    _manager = manager_;
  }

  function mintTickets(uint256 lotteryId, address to, uint256 tickets_, uint16[] calldata numbers_, uint16 lotterySize) external onlyLottery() {
    for (uint16 i = 0; i < tickets_; i++) {
      uint16 start;
      uint16 end;
      unchecked {
        start = uint16(i * lotterySize);
        end = uint16((i + 1) * lotterySize);
      }
      _totalSupply[lotteryId] += 1;

      uint16[] calldata numbers = numbers_[start:end];

      _ticketInfo[lotteryId][_totalSupply[lotteryId]] = TicketInfo(
        to,
        numbers,
        0,
        lotteryId
      );
      _userTickets[to][lotteryId].push(_totalSupply[lotteryId]);
      _mint(to, lotteryId, 1, msg.data);
    }

  }

  function claim(uint256 lotteryId, uint256 ticketId, uint16 maxRange) external onlyLottery() returns (bool) {
    for (uint256 i = 0; i < _ticketInfo[lotteryId][ticketId].numbers.length; i++) {
      if(_ticketInfo[lotteryId][ticketId].numbers[i] > maxRange) {
        return false;
      }
    }
    _ticketInfo[lotteryId][ticketId].claimed = 1;
    return true;
  }

  function totalSupply(uint256 id) public view virtual returns (uint256) {
    return _totalSupply[id];
  }

  function exists(uint256 id) public view virtual returns (bool) {
    return _totalSupply[id] > 0;
  }

  function getTicketNumbers(uint256 id, uint256 ticketId) external view returns(uint16[] memory) {
    return _ticketInfo[id][ticketId].numbers;
  }

  function ownerOf(uint256 id, uint256 ticketId) external view returns(address) {
    return _ticketInfo[id][ticketId].owner;
  }

  function claimed(uint256 id, uint256 ticketId) external view returns (bool) {
    return _ticketInfo[id][ticketId].claimed == 1;
  }

  function tickets(uint256 id, address user) external view returns (uint256[] memory) {
    return _userTickets[user][id];
  }

  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal virtual override {
    super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
      if (from != address(0)) {
        for (uint256 i = 0; i < ids.length; i++) {
          require(_ticketInfo[ids[i]][amounts[i]].owner == from, 'NOT_AN_OWNER');
          _ticketInfo[ids[i]][amounts[i]].owner = to;
        }
      }
  }
}
