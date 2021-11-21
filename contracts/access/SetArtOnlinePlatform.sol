// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import 'contracts/token/interfaces/IArtOnline.sol';
import 'contracts/bridger/IArtOnlineBridger.sol';
import 'contracts/token/interfaces/IArtOnlineMining.sol';
import 'contracts/staking/interfaces/IArtOnlineStaking.sol';
import 'contracts/access/IArtOnlineAccess.sol';
import 'contracts/control/IArtOnlineBlacklist.sol';
contract SetArtOnlinePlatform {

  IArtOnline internal _artOnlineInterface;
  IArtOnlineBridger internal _artOnlineBridgerInterface;
  IArtOnlineMining internal _artOnlineMiningInterface;
  IArtOnlineStaking internal _artOnlineStakingInterface;
  IArtOnlineAccess internal _artOnlineAccessInterface;
  IArtOnlineBlacklist internal _artOnlineBlacklistInterface;

  modifier isWhiteListed(address account) {
    require(_artOnlineBlacklistInterface.blacklisted(account) == false, 'BLACKLISTED');
    _;
  }

  modifier onlyAdmin() {
    require(_artOnlineAccessInterface.isAdmin(msg.sender) == true, 'NO_PERMISSION');
    _;
  }

  modifier onlyMinter() {
    require(_artOnlineAccessInterface.isMinter(msg.sender) == true, 'NO_PERMISSION');
    _;
  }

  modifier onlyExchange() {
    require(msg.sender == _artOnlineBridgerInterface.artOnlineExchange(), 'NO PERMISSION');
    _;
  }

  constructor(address artOnlineBridger_, address artOnlineAccess_) {
    _artOnlineBridgerInterface = IArtOnlineBridger(artOnlineBridger_);
    _artOnlineAccessInterface = IArtOnlineAccess(artOnlineAccess_);
  }

  function artOnlineBridgerInterface() external view returns (address) {
    return address(_artOnlineBridgerInterface);
  }

  function artOnlineInterface() external view  returns (address) {
    return address(_artOnlineInterface);
  }

  function artOnlineMiningInterface() external view  returns (address) {
    return address(_artOnlineMiningInterface);
  }

  function artOnlineStakingInterface() external view  returns (address) {
    return address(_artOnlineStakingInterface);
  }

  function artOnlineAccessInterface() external view  returns (address) {
    return address(_artOnlineAccessInterface);
  }

  function setArtOnlineBridgerInterface(address _artOnlineBridger) external onlyAdmin() {
    _artOnlineBridgerInterface = IArtOnlineBridger(_artOnlineBridger);
    address _artOnline = _artOnlineBridgerInterface.artOnline();
    address _artOnlineMining = _artOnlineBridgerInterface.artOnlineMining();
    address _artOnlineStaking = _artOnlineBridgerInterface.artOnlineStaking();
    address _artOnlineAccess = _artOnlineBridgerInterface.artOnlineAccess();
    address _artOnlineBlacklist = _artOnlineBridgerInterface.artOnlineBlacklist();

    if (address(_artOnlineInterface) != _artOnline) {
      _setArtOnlineInterface(_artOnline);
    }
    if (address(_artOnlineMiningInterface) != _artOnlineMining) {
      _setArtOnlineMiningInterface(_artOnlineMining);
    }
    if (address(_artOnlineStakingInterface) != _artOnlineStaking) {
      _setArtOnlineStakingInterface(_artOnlineStaking);
    }
    if (address(_artOnlineAccessInterface) != _artOnlineAccess) {
      _setArtOnlineAccessInterface(_artOnlineAccess);
    }

    if (address(_artOnlineBlacklistInterface) != _artOnlineBlacklist) {
      _setArtOnlineBlacklistInterface(_artOnlineBlacklist);
    }
  }

  function _setArtOnlineInterface(address _artOnline) internal {
    _artOnlineInterface = IArtOnline(_artOnline);
  }

  function _setArtOnlineMiningInterface(address _artOnlineMining) internal {
    _artOnlineMiningInterface = IArtOnlineMining(_artOnlineMining);
  }

  function _setArtOnlineStakingInterface(address _artOnlineStaking) internal {
    _artOnlineStakingInterface = IArtOnlineStaking(_artOnlineStaking);
  }

  function _setArtOnlineAccessInterface(address _artOnlineAccess) internal {
    _artOnlineAccessInterface = IArtOnlineAccess(_artOnlineAccess);
  }

  function _setArtOnlineBlacklistInterface(address _artOnlineBlacklist) internal {
    _artOnlineBlacklistInterface = IArtOnlineBlacklist(_artOnlineBlacklist);
  }

  function setArtOnlineInterface(address _address) external onlyAdmin() {
    _setArtOnlineInterface(_address);
  }

  function setArtOnlineMiningInterface(address _address) external onlyAdmin() {
    _setArtOnlineMiningInterface(_address);
  }

  function setArtOnlineStakingInterface(address _address) external onlyAdmin() {
    _setArtOnlineStakingInterface(_address);
  }

  function setArtOnlineAccessInterface(address _address) external onlyAdmin() {
    _setArtOnlineAccessInterface(_address);
  }

  function setArtOnlineBlacklistInterface(address _address) external onlyAdmin() {
    _setArtOnlineBlacklistInterface(_address);
  }
}
