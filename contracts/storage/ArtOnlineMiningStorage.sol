// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


contract ArtOnlineMiningStorage {
  uint256 internal _blockTime = 60;
  uint internal unlocked = 1;

  uint256[] internal _items;
  uint256[] internal _pools;
  uint256 internal _tax;

  mapping(uint256 => uint256) internal _totalMiners;
  mapping(uint256 => uint256) internal _maxReward;
  mapping(uint256 => address) internal _currency;
  mapping(uint256 => mapping(address => uint256)) internal _miners;
  mapping(uint256 => address[]) internal _miner;
  mapping(uint256 => mapping(address => mapping(uint256 => uint256))) internal _bonuses;

  mapping(uint256 => mapping(uint256 => uint256)) internal _mining;
  mapping(uint256 => mapping(uint256 => uint256)) internal _activated;
  mapping(uint256 => mapping(address => uint256)) internal _rewards;
  mapping(uint256 => mapping(address => uint256)) internal _startTime;
  mapping(uint256 => uint256) internal _halvings;
  mapping(uint256 => uint256) internal _nextHalving;
  mapping(uint256 => uint256) internal _activationPrice;

  event AddItem(string name, uint256 id, uint256 maxReward, uint256 halving, address currency, uint256 index);
  event AddPool(string name, uint256 id, uint256 maxReward, uint256 halving, address currency, uint256 index);
  event Activate(address indexed account, uint256 id, uint256 tokenId);
  event Deactivate(address indexed account, uint256 id, uint256 tokenId);
  event ActivateItem(address indexed account, uint256 id, uint256 itemId, uint256 tokenId);
  event DeactivateItem(address indexed account, uint256 id, uint256 itemId, uint256 tokenId);
  event Reward(address account, uint256 id, uint256 reward, address);
  event StakeReward(address account, uint256 id, uint256 reward, bytes32, address);
}
