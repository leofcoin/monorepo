// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "contracts/staking/interfaces/IArtOnlineStaking.sol";
import 'contracts/access/SetArtOnlineStaking.sol';
import 'contracts/token/utils/SafeArtOnline.sol';

contract ArtOnlineStaking is Context, Pausable, IArtOnlineStaking, SetArtOnlineStaking  {
  using Address for address;
  using SafeArtOnline for IArtOnline;
  uint256 internal _totalSupply;
  uint256 internal _releaseTime = 15770000;
  address internal _address;
  mapping (address => mapping(address => uint256)) internal _balances;
  mapping (address => bytes32[]) internal _stakeIds;
  mapping (address => mapping(bytes32 => uint256)) internal _stakes;
  mapping (address => mapping(bytes32 => uint256)) internal _times;
  mapping (address => mapping(bytes32 => uint256)) internal _claimed;
  mapping (address => mapping(address => uint256)) internal _stakers;
  mapping (address => address[]) internal _holders;
  mapping (address => mapping(bytes32 => address)) internal _currency;


  constructor(address bridger, address access)  SetArtOnlineStaking(bridger, access) {}

  function totalSupply() public view override(IArtOnlineStaking) returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address currency_, address sender) public view virtual override(IArtOnlineStaking) returns (uint256) {
    return _balances[currency_][sender];
  }

  function _beforeWithdraw(address currency_, address sender, uint256 amount) internal view whenNotPaused {
    require(_balances[currency_][sender] >= amount, 'NOT_ENOUGH_TOKENS');
  }

  function setReleaseTime(uint256 releaseTime_) external override onlyAdmin() {
    _releaseTime = releaseTime_;
  }

  function releaseTime() external view virtual override returns (uint256) {
    return _releaseTime;
  }

  function holders(address currency_) external view virtual override returns (address[] memory) {
    return _holders[currency_];
  }

  function stakeIds(address sender) external view returns (bytes32[] memory) {
    return _stakeIds[sender];
  }

  function readyToRelease(address sender, bytes32 id) external view override returns (bool) {
    return _times[sender][id] >= block.timestamp ? true : false;
  }

  function currency(address sender, bytes32 id) external view returns (address) {
    return _currency[sender][id];
  }

  function stake(address sender, uint256 amount, address currency_) external override onlyMinter() returns (bytes32) {
    require(currency_ != address(0), "CURRENCY_UNDEFINED");
    uint256 releaseTime_ = block.timestamp + _releaseTime;
    require(releaseTime_ > block.timestamp, "release time is before current time");
    bytes32 id = keccak256(abi.encodePacked(sender, releaseTime_));
    _stakeIds[sender].push(id);
    _stakes[sender][id] = amount;
    _times[sender][id] = releaseTime_;
    _currency[sender][id] = currency_;

    if (_balances[currency_][sender] == 0) {
      _holders[currency_].push(sender);
      _stakers[currency_][sender] = _holders[currency_].length - 1;
    }
    _balances[currency_][sender] += amount;

    return id;
  }

  function withdraw(address sender, bytes32 id) external override {
    require(_claimed[sender][id] == 0, "already withdrawn");
    require(_times[sender][id] > block.timestamp, "release time is before current time");
    uint256 amount = _stakes[sender][id];
    address currency_ = _currency[sender][id];

    _beforeWithdraw(currency_, sender, amount);

    IArtOnline(currency_).mint(sender, amount);

    _balances[currency_][sender] -= amount;
    _claimed[sender][id] = 1;

    uint256 index = _stakers[currency_][sender];
    _holders[currency_][index] = _holders[currency_][_holders[currency_].length - 1];

    _holders[currency_].pop();

    delete _stakers[currency_][sender];
  }

}
