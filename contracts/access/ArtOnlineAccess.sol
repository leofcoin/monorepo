// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import '@openzeppelin/contracts/access/AccessControl.sol';
import 'contracts/access/IArtOnlineAccess.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import "@openzeppelin/contracts/security/Pausable.sol";

contract ArtOnlineAccess is Context, AccessControl, Pausable, IArtOnlineAccess {
  bytes32 public constant MINT_ROLE = keccak256('MINT_ROLE');

  constructor() {
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    _setupRole(MINT_ROLE, _msgSender());
  }

  function isAdmin(address account) external view override whenNotPaused returns (bool) {
    return hasRole(DEFAULT_ADMIN_ROLE, account);
  }

  function isMinter(address account) external view override whenNotPaused returns (bool) {
    return hasRole(MINT_ROLE, account);
  }

  function pause() external virtual whenNotPaused onlyRole(DEFAULT_ADMIN_ROLE) {
    super._pause();
  }

  function unpause() external virtual whenPaused onlyRole(DEFAULT_ADMIN_ROLE) {
    super._unpause();
  }
}
