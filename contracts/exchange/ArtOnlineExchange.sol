
// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import './../storage/ArtOnlineExchangeStorage.sol';
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./../token/utils/SafeArtOnline.sol";
import "./../token/interfaces/IArtOnline.sol";
import "./../staking/interfaces/IArtOnlineStaking.sol";
import "./../token/interfaces/IArtOnlinePlatform.sol";
import './../token/utils/EIP712.sol';

contract ArtOnlineExchange is Context, ERC165, EIP712, Pausable, ArtOnlineExchangeStorage {
  using Address for address;

  modifier isListed(uint256 id, uint256 tokenId) {
    if (tokenId == 0) {
      require(lists[id].listed == 1, 'NOT_LISTED');
    } else {
      require(auctions[id][tokenId].listed == 1, 'NOT_AUCTIONED');
    }
    _;
  }

  modifier lock() {
    require(unlocked == 1, 'LOCKED');
    unlocked = 0;
    _;
    unlocked = 1;
  }

  constructor() EIP712('ArtOnline Exchange', 'V2') {
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
  }

  function setArtOnline(address artonline_) external onlyRole(DEFAULT_ADMIN_ROLE) lock {
    _artOnline = artonline_;
  }

  function setArtOnlineStaking(address artOnlineStaking_) external onlyRole(DEFAULT_ADMIN_ROLE) lock {
    _artOnlineStaking = artOnlineStaking_;
  }

  function setArtOnlinePlatform(address artOnlinePlatform_) external onlyRole(DEFAULT_ADMIN_ROLE) lock {
    _artOnlinePlatform = artOnlinePlatform_;
  }

  function artOnline() external view virtual returns (address) {
    return _artOnline;
  }

  function artOnlinePlatform() external view virtual returns (address) {
    return _artOnlinePlatform;
  }

  function listingLength() external view returns (uint256) {
    return listings.length;
  }

  function auctionLength(uint256 id) external view returns (uint256) {
    return _auctions[id].length;
  }

  function nativeListingLength(uint256 id) external view returns (uint256) {
    return _nativeListings[id].length;
  }

  function list(uint256 id, uint256 tokenId, uint256 price) external whenNotPaused lock {
    if (tokenId == 0) {
      require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), 'NOT_AN_ADMIN');
      require(lists[id].listed == 0, 'LISTING_EXISTS');
      listings.push(id);
      lists[id].price = price;
      lists[id].listed = 1;

      emit List(id, tokenId, price);
    } else {
      require(auctions[id][tokenId].listed == 0, 'LISTING_EXISTS');
      require(IArtOnlinePlatform(_artOnlinePlatform).ownerOf(id, tokenId) == _msgSender(), 'NOT_AN_OWNER');

      IArtOnlinePlatform(_artOnlinePlatform).safeTransferFrom(_msgSender(), address(this), id, tokenId, '');

      _auctions[id].push(tokenId);
      auctions[id][tokenId].price = price;
      auctions[id][tokenId].listed = 1;
      auctions[id][tokenId].seller = _msgSender();

      emit List(id, tokenId, price);
    }
  }

  function forceDelist(uint256 id, uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
    IArtOnlinePlatform(_artOnlinePlatform).safeTransferFrom(address(this), auctions[id][tokenId].seller, id, tokenId, '');
    __removeAuction(id, tokenId);
  }

  function delist(uint256 id, uint256 tokenId) external whenNotPaused {
    _removeAuction(id, tokenId, _msgSender());
  }

  function _removeAuction(uint256 id, uint256 tokenId, address owner) internal {
    require(IArtOnlinePlatform(_artOnlinePlatform).ownerOf(id, tokenId) == owner, 'NOT_AN_OWNER');
    __removeAuction(id, tokenId);
  }

  function __removeAuction(uint256 id, uint256 tokenId) internal {
    auctions[id][tokenId].listed = 0;
    emit Delist(id, tokenId);
  }

  function buy(uint256 id, uint256 tokenId) external whenNotPaused isListed(id, tokenId) {
    address owner;
    uint256 price;
    if (tokenId == uint256(0)) {
      owner = _artOnlinePlatform;
      price = lists[id].price;
    } else {
      owner = IArtOnlinePlatform(_artOnlinePlatform).ownerOf(id, tokenId);
      require(owner == address(this), 'INVALID OWNER');
      price = auctions[id][tokenId].price;
    }
    address account = _msgSender();
    require(owner != account, 'SELLER_OWN');
    require(IArtOnline(_artOnline).balanceOf(account) >= price, 'NOT_ENOUGH_TOKENS');

    if (owner == _artOnlinePlatform) {
      address[] memory holders_ = IArtOnlineStaking(_artOnlineStaking).holders(_artOnline);
      if (holders_.length > 0) {
        uint256 dividends = (price / 100) * 5;
        IArtOnline(_artOnline).burn(account, price - dividends);

        uint256 dividend = dividends / holders_.length;
        for (uint256 i = 0; i < holders_.length; i++) {
          SafeArtOnline.safeTransferFrom(IArtOnline(_artOnline), account, holders_[i], dividend);
        }
      } else {
        IArtOnline(_artOnline).burn(account, price);
      }

      tokenId = IArtOnlinePlatform(_artOnlinePlatform).mintAsset(account, id);

    } else {
      SafeArtOnline.safeTransferFrom(IArtOnline(_artOnline), account, auctions[id][tokenId].seller, price);
      IArtOnlinePlatform(_artOnlinePlatform).safeTransferFrom(address(this), account, id, tokenId, '');
      _removeAuction(id, tokenId, _msgSender());
    }
    emit Sold(id, tokenId, account, price);
  }

  function setPrice(uint256 id, uint256 tokenId, uint256 price) external whenNotPaused isListed(id, tokenId) {
    if (tokenId == 0) {
      require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) == true, 'NOT_AN_ADMIN');
      lists[id].price = price;
    } else {
      require(IArtOnlinePlatform(_artOnlinePlatform).ownerOf(id, tokenId) == _msgSender(), 'NOT_AN_OWNER');
      auctions[id][tokenId].price = price;
    }
  }

  function getPrice(uint256 id, uint256 tokenId) public view isListed(id, tokenId) returns (uint256) {
    if (tokenId == 0) {
      return lists[id].price;
    }
    return auctions[id][tokenId].price;
  }

  function pause() external virtual whenNotPaused onlyRole(DEFAULT_ADMIN_ROLE) {
    super._pause();
  }

  function unpause() external virtual whenPaused onlyRole(DEFAULT_ADMIN_ROLE) {
    super._unpause();
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl, ERC165) returns (bool) {
    return
      super.supportsInterface(interfaceId);
  }
}
