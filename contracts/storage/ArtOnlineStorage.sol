// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract ArtOnlineStorage is AccessControl {
  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
  bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");

  mapping(address => uint256) internal _balances;
  mapping(address => mapping(address => uint256)) internal _allowances;
  // mapping(address => Counters.Counter) internal _nonces;

  // solhint-disable-next-line var-name-mixedcase
  bytes32 internal immutable _PERMIT_TYPEHASH =
    keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

  uint256 internal _totalSupply;
  string internal _name = 'ArtOnline';
  string internal _symbol = 'ART';
  uint256 internal _cap;
  address internal _platform;
  uint256 public percentSettings = 200;

  // function getNonce(address owner) external view virtual returns (uint256) {
  //   return _nonces[owner].current();
  // }
}
