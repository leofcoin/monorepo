// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import 'contracts/storage/ArtOnlineStorage.sol';

contract ArteonProxy is ArtOnlineStorage {
  address internal _owner;
  mapping (bytes32 => address) internal _delegates;

  modifier onlyOwner() {
    require(_owner == msg.sender, 'Only owner');
    _;
  }

  function addDelegate(bytes memory name, address delegate) external onlyOwner() {
    bytes32 _name = keccak256(name);
    require(_delegates[_name] == address(0));
    _delegates[_name] = delegate;
  }

  function upgradeDelegate(bytes memory name, address delegate) external onlyOwner() {
    bytes32 _name = keccak256(name);
    require(_delegates[_name] != address(0));
    _delegates[_name] = delegate;
  }

  function owner() public virtual view returns(address) {
    return _owner;
  }

  fallback() external payable {
    (bytes32 data)= abi.decode(msg.data, (bytes32));
    address target = _delegates[data];
    require(target != address(0), "Delegate does not exist");

    assembly {
      calldatacopy(0, 0, calldatasize())
      let result := delegatecall(gas(), target, 0, calldatasize(), 0, 0)
      returndatacopy(0, 0, returndatasize())
      switch result
        case 0 {
          revert(0, returndatasize())
        }
        default {
          return(0, returndatasize())
      }
    }
  }
  receive() external payable {}
}
