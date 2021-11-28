// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import 'contracts/access/SetArtOnlineBase.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

contract ArtOnlinePoolPartner is SetArtOnlineBase {
  string internal _name;
  address internal _token;
  bytes32 internal _POOL_ROLE;

  modifier onlyPool() {
    require(_artOnlineAccessInterface.artOnlinePlatform == msg.sender, 'NO_PERMISSION');
    _;
  }

  modifier onlyPoolAdmin() {
    require(_artOnlineAccessInterface.hasRole(_POOL_ROLE, msg.sender) == true, 'NO_PERMISSION');
    _;
  }

  modifier whenPaused() {
    require(_artOnlineAccessInterface.paused() == true, 'NO_PERMISSION');
    _;
  }

  modifier notPaused() {
    require(_artOnlineAccessInterface.paused() == false, 'NO_PERMISSION');
    _;
  }

  constructor(
    string memory name_,
    address token_,
    address bridger,
    address access
  ) SetArtOnlineBase(bridger, access) {
    _name = name_;
    _token = token_;
    _POOL_ROLE = keccak256(abi.encodePacked('POOL_ROLE', _token));
    _artOnlineAccessInterface.grantRole(_POOL_ROLE, msg.sender);
  }

  function POOL_ROLE() external view returns (bytes32) {
    return _POOL_ROLE;
  }

  function name() external view returns (string memory) {
    return _name;
  }

  function token() external view returns (address) {
    return _token;
  }

  function setToken(address token_) external pure onlyAdmin() {
    _token = token_;
  }

  function topUp(address sender, uint256 amount) external notPaused() {
    SafeERC20.IERC20(_token).safeTransferFrom(sender, address(this), amount);
  }

  function drain(address receiver, uint256 amount) external whenPaused() onlyPoolAdmin() {
    SafeERC20.IERC20(_token).safeTransferFrom(address(this), receiver, amount);
  }

  function mint(address receiver, uint256 amount) external notPaused() onlyPool() {
    SafeERC20.IERC20(_token).safeTransferFrom(address(this), receiver, amount);
  }
}
