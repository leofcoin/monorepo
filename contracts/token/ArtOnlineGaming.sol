// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import './interfaces/IArtOnline.sol';

contract ArtOnlineGaming is Initializable, ERC20Upgradeable, ERC20BurnableUpgradeable, PausableUpgradeable, AccessControlUpgradeable, ERC20PermitUpgradeable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    address internal _artOnline;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize() initializer public {
      __ERC20_init("ArtOnlineGaming", "ARTG");
      __ERC20Burnable_init();
      __Pausable_init();
      __AccessControl_init();
      __ERC20Permit_init("ArtOnlineGaming");

      _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
      _grantRole(PAUSER_ROLE, msg.sender);
      _grantRole(MINTER_ROLE, msg.sender);
    }

    function setArtOnline(address artOnline_) public onlyRole(DEFAULT_ADMIN_ROLE) {
      _artOnline = artOnline_;
    }

    function pause() public onlyRole(PAUSER_ROLE) {
      _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
      _unpause();
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
      _mint(to, amount);
    }

    function deposit(uint256 amount) external {
      IArtOnline(_artOnline).burn(msg.sender, amount);
      _mint(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
      _burn(msg.sender, amount);
      IArtOnline(_artOnline).mint(msg.sender, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
      internal
      whenNotPaused
      override
    {
      super._beforeTokenTransfer(from, to, amount);
    }
}
