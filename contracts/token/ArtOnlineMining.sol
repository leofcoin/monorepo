// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "contracts/storage/ArtOnlineMiningStorage.sol";
import 'contracts/token/utils/EIP712.sol';
import 'contracts/access/SetArtOnlineMining.sol';

contract ArtOnlineMining is Context, EIP712, SetArtOnlineMining, ArtOnlineMiningStorage  {
  using Address for address;

  modifier lock() {
    require(unlocked == 1, 'LOCKED');
    unlocked = 0;
    _;
    unlocked = 1;
  }

  constructor(string memory name, string memory version, address bridger, address access)
    EIP712(name, version)
    SetArtOnlineMining(bridger, access) {}

  function mining(uint256 id, uint256 tokenId) external view virtual returns (uint256) {
    return _mining[id][tokenId];
  }

  function _addAsset(uint256 id, uint256 maxReward_, uint256 halving, address currency_) internal {
    _maxReward[id] = maxReward_;
    _halvings[id] = halving;
    unchecked {
      _nextHalving[id] = block.number + halving;
    }
    _currency[id] = currency_;
  }

  function addItem(string memory name, uint256 id, uint256 bonus, uint256 halving, address currency_) public onlyAdmin() {
    _addAsset(id, bonus, halving, currency_);
    _items.push(id);
    emit AddItem(name, id, bonus, halving, currency_, _items.length - 1);
  }

  function addPool(string memory name, uint256 id, uint256 maxReward, uint256 halving, address currency_) public onlyAdmin() {
    _addAsset(id, maxReward, halving, currency_);
    _pools.push(id);
    emit AddPool(name, id, maxReward, halving, currency_, _pools.length - 1);
  }

  function _rewardPerGPU(uint256 id) internal view returns (uint256) {
    if (_totalMiners[id] == 0) {
      return 0;
    }
    return _maxReward[id] / _totalMiners[id];
  }

  function setActivationPrice(uint256 id, uint256 price) external onlyAdmin() {
    _activationPrice[id] = price;
  }

  function activationPrice(uint256 id) public view returns (uint256) {
    return _activationPrice[id];
  }

  function getHalvings(uint256 id) public view returns (uint256) {
    return _halvings[id];
  }

  function getNextHalving(uint256 id) public view returns (uint256) {
    return _nextHalving[id];
  }

  function rewards(address account, uint256 id) public view returns (uint256) {
    return _rewards[id][account];
  }

  function rewardPerGPU(uint256 id) public view returns (uint256) {
    return _rewardPerGPU(id);
  }

  function getMaxReward(uint256 id) public view returns (uint256) {
    return _maxReward[id];
  }

  function earned(address account, uint256 id) public returns (uint256) {
    return _calculateReward(account, id);
  }

  function miners(uint256 id) public view virtual returns (uint256) {
    return _totalMiners[id];
  }

  function activateGPUBatch(address sender, uint256[] memory ids, uint256[] memory amounts) external {
    for (uint256 i = 0; i < ids.length; i++) {
      activateGPU(sender, ids[i], amounts[i]);
    }
  }

  function deactivateGPUBatch(address sender, uint256[] memory ids, uint256[] memory amounts) external {
    for (uint256 i = 0; i < ids.length; i++) {
      deactivateGPU(sender, ids[i], amounts[i]);
    }
  }

  function activateGPU(address sender, uint256 id, uint256 tokenId) public isWhiteListed(sender) lock {
    _beforeAction(sender, id, tokenId);
    // if (_miners[id][sender] > 0) {
    //   getReward(sender, id);
    // }
    _activateGPU(sender, id, tokenId);
    emit Activate(sender, id, tokenId);
  }

  function deactivateGPU(address sender, uint256 id, uint256 tokenId) public isWhiteListed(sender) lock {
    _beforeAction(sender, id, tokenId);
    // getReward(sender, id);
    _deactivateGPU(sender, id, tokenId);
    emit Deactivate(sender, id, tokenId);
  }

  function activateItem(address sender, uint256 id, uint256 itemId, uint256 tokenId) external isWhiteListed(sender) lock {
    _beforeAction(sender, itemId, tokenId);
    uint256 price = activationPrice(itemId);
    _artOnlineInterface.burn(sender, price);
    // if (_miners[id][sender] > 0) {
    //   getReward(sender, id);
    // }
    _activateItem(sender, id, itemId, tokenId);
    emit ActivateItem(sender, id, itemId, tokenId);
  }

  function deactivateItem(address sender, uint256 id, uint256 itemId, uint256 tokenId) external isWhiteListed(sender) lock {
    _beforeAction(sender, itemId, tokenId);
    uint256 price = activationPrice(itemId);
    _artOnlineInterface.burn(sender, price);
    // if (_miners[id][sender] > 0) {
    //   getReward(sender, id);
    // }
    _deactivateItem(sender, id, itemId, tokenId);
    emit DeactivateItem(sender, id, itemId, tokenId);
  }

  function getReward(address sender, uint256 id) public isWhiteListed(sender) {
    uint256 reward = _calculateReward(sender, id);

    if (reward > 0) {
      uint256 taxed = (reward / 100) * _tax;
      uint256 dividends = (taxed / 100) * 5;
      _artOnlineInterface.mint(sender, reward - taxed);

      address[] memory holders_ = _artOnlineStakingInterface.holders();
      if (holders_.length > 0) {
        uint256 dividend = dividends / holders_.length;
        for (uint256 i = 0; i < holders_.length; i++) {
          _artOnlineInterface.mint(holders_[i], dividend);
        }
      }
      _rewards[id][sender] = 0;
      _startTime[id][sender] = block.timestamp;
      emit Reward(sender, id, reward - taxed);
    }
  }

  function stakeReward(address sender, uint256 id) external isWhiteListed(sender) lock returns (bytes32) {
    bytes32 stakeId;
    uint256 reward = _calculateReward(sender, id);
    if (reward > 0) {
      stakeId = _artOnlineStakingInterface.stake(sender, reward);
      _rewards[id][sender] = 0;
      _startTime[id][sender] = block.timestamp;
      emit Reward(sender, id, reward);
    }
    return stakeId;
  }

  function stakeRewardBatch(address sender, uint256[] memory ids) external isWhiteListed(sender) lock returns (bytes32[] memory stakeIds) {
    for (uint256 i = 0; i < ids.length; i++) {
      uint256 id = ids[i];
      uint256 reward = _calculateReward(sender, id);
      if (reward > 0) {
        _artOnlineInterface.mint(sender, reward);
        bytes32 stakeId = _artOnlineStakingInterface.stake(sender, reward);
        stakeIds[i] = stakeId;
        _rewards[id][sender] = 0;
        _startTime[id][sender] = block.timestamp;
        emit Reward(sender, id, reward);
      }
    }
  }

  function getRewardBatch(address sender, uint256[] memory ids) external isWhiteListed(sender) {
    for (uint256 i = 0; i < ids.length; i++) {
      uint256 id = ids[i];
      uint256 reward = _calculateReward(sender, id);
      if (reward > 0) {
        uint256 taxed = (reward / 100) * _tax;
        uint256 dividends = (taxed / 100) * 5;
        _artOnlineInterface.mint(sender, reward - taxed);
        address[] memory holders_ = _artOnlineStakingInterface.holders();
        if (holders_.length > 0) {
          uint256 dividend = dividends / holders_.length;
          for (uint256 holder = 0; holder < holders_.length; holder++) {
            _artOnlineInterface.mint(holders_[holder], dividend);
          }
        }
        _rewards[id][sender] = 0;
        _startTime[id][sender] = block.timestamp;
        emit Reward(sender, id, reward - taxed);
      }
    }
  }

  function itemBonus(uint256 id) external view returns (uint256) {
    return _maxReward[id];
  }

  function _itemBonuses(address sender, uint256 id) internal view returns (uint256) {
    uint256 percentage;

    for (uint256 i = 0; i < _items.length; i++) {
      uint256 itemId = _items[i];
      if (_bonuses[id][sender][itemId] > 0) {
        percentage = percentage + (_maxReward[itemId] * _bonuses[id][sender][itemId]);
      }

    }
    return percentage;
  }

  function _calculateReward(address sender, uint256 id) internal returns (uint256) {
    uint256 startTime = _startTime[id][sender];
    if (block.timestamp > startTime + _blockTime) {
      unchecked {
        uint256 remainder = block.timestamp - startTime;
        uint256 reward = (_rewardPerGPU(id) * _miners[id][sender]) * remainder;
        _rewards[id][sender] = _rewards[id][sender] + (reward + ((reward / 100) * _itemBonuses(sender, id)));
      }
      _startTime[id][sender] = block.timestamp;
    }
    return _rewards[id][sender];
  }

  function _beforeAction(address account, uint256 id, uint256 tokenId) internal view {
    require(tokenId > 0, "NO_ZERO");
    require(_artOnlinePlatformInterface.ownerOf(id, tokenId) == account, 'NOT_OWNER');
  }

  function _activateItem(address account, uint256 id, uint256 itemId, uint256 tokenId) internal {
    require(_miners[id][account] > _bonuses[id][account][itemId], 'UPGRADE_CAP');
    require(_activated[itemId][tokenId] == 0, 'DEACTIVATE_FIRST');
    unchecked {
      _bonuses[id][account][itemId] += 1;
      _activated[itemId][tokenId] = 1;
    }
    _checkHalving(id);
    _rewardPerGPU(id);
  }

  function _deactivateItem(address account, uint256 id, uint256 itemId, uint256 tokenId) internal {
    require(_activated[itemId][tokenId] == 0, 'NOT_ACTIVATED');
    unchecked {
      _bonuses[id][account][itemId] -= 1;
      _activated[itemId][tokenId] = 0;
    }
    _checkHalving(id);
    _rewardPerGPU(id);
  }

  function _activateGPU(address account, uint256 id, uint256 tokenId) internal {
    unchecked {
      _startTime[id][account] = block.timestamp;
      _miners[id][account] += 1;
    }
    _mining[id][tokenId] = 1;
    _totalMiners[id] += 1;
    _checkHalving(id);
    _rewardPerGPU(id);
  }

  function _deactivateGPU(address account, uint256 id, uint256 tokenId) internal {
    unchecked {
      _miners[id][account] -= 1;
      _totalMiners[id] -= 1;
      _mining[id][tokenId] = 0;
    }
    if (_miners[id][account] == 0) {
      delete _startTime[id][account];
    } else {
      _startTime[id][account] = block.timestamp;
    }
    for (uint256 i = 0; i < _items.length; i++) {
      uint256 itemId = _items[i];
      require(_bonuses[id][account][itemId] == 0, 'Deactivate upgrades first');
    }
    _checkHalving(id);
    _rewardPerGPU(id);
  }

  function _checkHalving(uint256 id) internal {
    uint256 blockHeight = block.number;
    if (blockHeight > _nextHalving[id]) {
      unchecked {
        _nextHalving[id] += _halvings[id];
        _maxReward[id] = _maxReward[id] / 2;
      }
    }
  }

  function poolsLength() external view virtual returns (uint256) {
    return _pools.length;
  }

  function itemsLength() external view virtual returns (uint256) {
    return _items.length;
  }

  function pools() external view virtual returns (uint256[] memory) {
    return _pools;
  }

  function items() external view virtual returns (uint256[] memory) {
    return _items;
  }

  function pool(uint256 id) external view virtual returns (uint256) {
    return _pools[id];
  }

  function item(uint256 id) external view virtual returns (uint256) {
    return _items[id];
  }

  function bonuses(uint256 id, address account, uint256 tokenId) external view returns (uint256) {
    return _bonuses[id][account][tokenId];
  }

  function activated(uint256 id, uint256 tokenId) external view returns (uint256) {
    return _activated[id][tokenId];
  }

  function poolInfo(address sender, uint256 id) external returns (uint256[] memory) {
    uint256[] memory _poolInfo = new uint256[](3);
    _poolInfo[0] = _totalMiners[id];
    _poolInfo[1] = _maxReward[id];
    _poolInfo[2] = _calculateReward(sender, id);
    return _poolInfo;
  }

  function setTax(uint256 tax_) external onlyAdmin() {
    _tax = tax_;
  }

  function tax() external view returns (uint256) {
    return _tax;
  }

}
