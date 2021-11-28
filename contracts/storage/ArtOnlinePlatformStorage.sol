// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


contract ArtOnlinePlatformStorage {

  uint256 internal _blockTime = 60;
  string internal _uri;
  uint internal unlocked = 1;

  string[] internal _tokens;
  uint256[] internal _items;
  uint256[] internal _pools;

  mapping(uint256 => string) public tokenNames;

  mapping(uint256 => uint256) internal _totalMiners;
  mapping(uint256 => uint256) internal _maxReward;
  mapping(uint256 => mapping(address => uint256)) internal _balances;
  mapping(address => mapping(address => bool)) internal _operatorApprovals;
  // _miners[id][address] = balance
  mapping(uint256 => mapping(address => uint256)) internal _miners;
  mapping(uint256 => mapping(address => mapping(uint256 => uint256))) internal _bonuses;

  mapping(uint256 => mapping(uint256 => uint256)) internal _mining;
  mapping(uint256 => mapping(uint256 => uint256)) internal _activated;
  mapping(uint256 => mapping(uint256 => address)) internal _owners;
  mapping(uint256 => mapping(address => uint256)) internal _rewards;
  mapping(uint256 => mapping(address => uint256)) internal _startTime;
  mapping(uint256 => uint256) internal _totalSupply;
  mapping(uint256 => uint256) internal _halvings;
  mapping(uint256 => uint256) internal _nextHalving;
  mapping(address => uint256) internal _blacklist;

  mapping(uint256 => uint256) internal _cap;
  mapping(uint256 => uint256) internal _activationPrice;

  event AddToken(string name, uint256 id);
  event AddItem(string name, uint256 id, uint256 bonus);
  event AddPool(string name, uint256 id, uint256 bonus);
  event Activate(address indexed account, uint256 id, uint256 tokenId);
  event Deactivate(address indexed account, uint256 id, uint256 tokenId);
  event ActivateItem(address indexed account, uint256 id, uint256 itemId, uint256 tokenId);
  event DeactivateItem(address indexed account, uint256 id, uint256 itemId, uint256 tokenId);
  event Reward(address account, uint256 id, uint256 reward);
}
