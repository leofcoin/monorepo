// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import './../libs/StorageSlot.sol';
import './interfaces/IUpgradeableProxy.sol';

contract UpgradeableProxy is IUpgradeableProxy {
  bytes32 private constant PROXY_IMPLEMENTATION = bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1);
  bytes32 private constant PROXY_MANAGER_SLOT = bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1);

  event ManagerChanged(address previous, address current);

  modifier ifManager() {
    if (msg.sender == _getManager()) {
      _;
    } else {
      _fallback();
    }
  }

  constructor(address manager_) {
    _changeManager(manager_);
  }

  function setImplementation(address implementation_) external override ifManager {
    StorageSlot.setAddressAt(PROXY_IMPLEMENTATION, implementation_);
  }

  function _delegate(address implementation_) internal virtual {
    assembly {
      // get next free memory slot index
      let ptr := mload(0x40)
      // copy data into the free memory slot
      calldatacopy(ptr, 0, calldatasize())

      // delegate the call
      let result := delegatecall(
        gas(),
        implementation_,
        ptr,
        calldatasize(),
        0,
        0
      )

      let size := returndatasize()
      returndatacopy(ptr, 0, size)

      // expect a result or revert
      switch result
      case 0 {
        revert(0, returndatasize())
      }
      default {
        return(0, returndatasize())
      }
    }
  }

  function changeManager(address manager_) external virtual override ifManager {
    _changeManager(manager_);
  }

  function _changeManager(address manager_) internal {
    require(manager_ != address(0), "given address is the zero address");
    emit ManagerChanged(_getManager(), manager_);
    StorageSlot.setAddressAt(PROXY_MANAGER_SLOT, manager_);
  }

  function _getManager() internal view returns (address) {
    return StorageSlot.getAddressAt(PROXY_MANAGER_SLOT);
  }

  function manager() external ifManager returns (address) {
    return _getManager();
  }

  function _beforeFallback() internal virtual {
    require(msg.sender != _getManager(), 'MANAGER_NOT_ALLOWED');
  }

  function _fallback() internal virtual {
    _beforeFallback();
    _delegate(StorageSlot.getAddressAt(PROXY_IMPLEMENTATION));
  }

  fallback() external payable virtual {
    _fallback();
  }

  receive() external payable virtual {
    _fallback();
  }
}
