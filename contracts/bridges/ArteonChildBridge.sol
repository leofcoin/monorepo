// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import 'contracts/tunnel/FxBaseChildTunnel.sol';
import 'contracts/token/interfaces/IArteonL1L2.sol';

contract ArteonChildBridge is Context, ERC1155Holder, AccessControl, Pausable, FxBaseChildTunnel {
  bytes32 public constant DEPOSIT = keccak256("DEPOSIT");
  bytes32 public constant DEPOSIT_BATCH = keccak256("DEPOSIT_BATCH");
  bytes32 public constant WITHDRAW = keccak256("WITHDRAW");
  bytes32 public constant WITHDRAW_BATCH = keccak256("WITHDRAW_BATCH");

  address internal _rootToken;
  address internal _childToken;

  event TokenMapped(address indexed rootToken, address indexed childToken);

  constructor(address fxChild) FxBaseChildTunnel(fxChild) {
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl, ERC1155Receiver) returns (bool) {
    return interfaceId == type(IArteonL1L2).interfaceId || super.supportsInterface(interfaceId);
  }

  // token/proxy
  function mapToken(address rootToken_, address childToken_) external onlyRole(DEFAULT_ADMIN_ROLE) {
    _rootToken = rootToken_;
    _childToken = childToken_;
    emit TokenMapped(_rootToken, _childToken);
  }

  function withdraw(uint256 id, uint256 amount, bytes memory data) public {
    require(
      _rootToken != address(0x0) &&
      _childToken != address(0x0), "FxERC1155ChildTunnel: NO_MAPPED_TOKEN");

    IArteonL1L2(_childToken).burn(msg.sender, id, amount);

    bytes memory message = abi.encode(WITHDRAW, abi.encode(_rootToken, _childToken, msg.sender, id, amount, data));
    _sendMessageToRoot(message);
  }

  function withdrawBatch(uint256[] memory ids, uint256[] memory amounts, bytes memory data) public {
    require(
      _rootToken != address(0x0) &&
      _childToken != address(0x0), "FxERC1155ChildTunnel: NO_MAPPED_TOKEN");

    IArteonL1L2(_childToken).burnBatch(msg.sender, ids, amounts);

    bytes memory message = abi.encode(WITHDRAW_BATCH, abi.encode(_rootToken, _childToken, msg.sender, ids, amounts, data));
     _sendMessageToRoot(message);
  }

  function _processMessageFromRoot(uint256 /* stateId */, address sender, bytes memory data)
    internal
    override
    validateSender(sender) {

    (bytes32 syncType, bytes memory syncData) = abi.decode(data, (bytes32, bytes));

    if (syncType == DEPOSIT) {
      _syncDeposit(syncData);
    } else if(syncType == DEPOSIT_BATCH) {
      _syncDepositBatch(syncData);
    } else {
      revert("ArteonBridge: INVALID_SYNC_TYPE");
    }
  }

  function _syncDeposit(bytes memory syncData) internal {
    (address rootToken, address depositor, address user, uint256 id, uint256 amount, bytes memory data) = abi.decode(syncData, (address, address, address, uint256, uint256, bytes));
    require(rootToken == _rootToken, 'ArteonBridge: INVALID_ROOT');

    IArteonL1L2(_childToken).mint(user, id, amount);
  }

  function _syncDepositBatch(bytes memory syncData) internal {
    (address rootToken, address depositor, address user, uint256[] memory ids, uint256[] memory amounts, bytes memory data) = abi.decode(syncData, (address, address, address, uint256[], uint256[], bytes));
    require(rootToken == _rootToken, 'ArteonBridge: INVALID_ROOT');

    IArteonL1L2(_childToken).mintBatch(user, ids, amounts);
  }

   function pause() external virtual whenNotPaused onlyRole(DEFAULT_ADMIN_ROLE) {
     super._pause();
   }

   function unpause() external virtual whenPaused onlyRole(DEFAULT_ADMIN_ROLE) {
     super._unpause();
   }
}
