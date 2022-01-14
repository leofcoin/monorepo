// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import './../token/interfaces/IArtOnline.sol';
import './../bridger/IArtOnlineBridger.sol';
import './IArtOnlineAccess.sol';
import './../common/Initializable.sol';

contract SetArtOnlineStaking is Initializable {
  IArtOnline internal _artOnlineInterface;
  IArtOnlineBridger internal _artOnlineBridgerInterface;
  IArtOnlineAccess internal _artOnlineAccessInterface;

  modifier onlyAdmin() {
    require(_artOnlineAccessInterface.isAdmin(msg.sender) == true, 'NO_PERMISSION');
    _;
  }

  modifier onlyMinter() {
    require(_artOnlineAccessInterface.isMinter(msg.sender) == true, 'NO_PERMISSION');
    _;
  }

  initialize(address artOnlineBridger_, address artOnlineAccess_) external initializer() onlyAdmin() {
    _artOnlineBridgerInterface = IArtOnlineBridger(artOnlineBridger_);
    _artOnlineAccessInterface = IArtOnlineAccess(artOnlineAccess_);
  }

  function artOnlineBridgerInterface() external view returns (address) {
    return address(_artOnlineBridgerInterface);
  }

  function artOnlineInterface() external view  returns (address) {
    return address(_artOnlineInterface);
  }

  function artOnlineAccessInterface() external view  returns (address) {
    return address(_artOnlineAccessInterface);
  }


  function setArtOnlineBridgerInterface(address _artOnlineBridger) external onlyAdmin() {
    _artOnlineBridgerInterface = IArtOnlineBridger(_artOnlineBridger);
    address _artOnline = _artOnlineBridgerInterface.artOnline();
    address _artOnlineAccess = _artOnlineBridgerInterface.artOnlineAccess();

    if (address(_artOnlineInterface) != _artOnline) {
      _setArtOnlineInterface(_artOnline);
    }
    if (address(_artOnlineAccessInterface) != _artOnlineAccess) {
      _setArtOnlineAccessInterface(_artOnlineAccess);
    }
  }

  function _setArtOnlineInterface(address _artOnline) internal {
    _artOnlineInterface = IArtOnline(_artOnline);
  }

  function _setArtOnlineAccessInterface(address _artOnlineAccess) internal {
    _artOnlineAccessInterface = IArtOnlineAccess(_artOnlineAccess);
  }

  function setArtOnlineInterface(address _address) external onlyAdmin() {
    _setArtOnlineInterface(_address);
  }

  function setArtOnlineAccessInterface(address _address) external onlyAdmin() {
    _setArtOnlineAccessInterface(_address);
  }
}
