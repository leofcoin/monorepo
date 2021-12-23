// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import './../storage/ArtOnlineExchangeFactoryStorage.sol';
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import './../token/utils/EIP712.sol';
import "./../token/utils/SafeArtOnline.sol";
import "./../token/interfaces/IArtOnline.sol";
import "./../token/interfaces/IArtOnlinePlatform.sol";
import "./ArtOnlineListing.sol";
import "./ArtOnlineListingERC1155.sol";
import "./interfaces/IArtOnlineListing.sol";
import "./interfaces/IArtOnlineListingERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract ArtOnlineExchangeFactory is Context, ERC165, Pausable, EIP712, ArtOnlineExchangeFactoryStorage {
  using Address for address;

  modifier isListed(address listing) {
    require(IArtOnlineListing(listing).listed() == 1, 'NOT_LISTED');
    _;
  }

  modifier lock() {
    require(_unlocked == 1, 'LOCKED');
    _unlocked = 0;
    _;
    _unlocked = 1;
  }

  constructor(string memory name, string memory version)
    EIP712(name, version) {
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl, ERC165) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

  function setFeeReceiver(address receiver) external onlyRole(DEFAULT_ADMIN_ROLE) {
    _feeReceiver = receiver;
  }

  function feeReceiver() external view returns (address) {
    return _feeReceiver;
  }

  function setFee(uint256 fee_) external onlyRole(DEFAULT_ADMIN_ROLE) {
    _fee = fee_;
  }

  function fee() external virtual view returns(uint256) {
    return _fee;
  }

  function listingLength() external view returns (uint256) {
    return listings.length;
  }

  function listingERC1155Length() external view returns (uint256) {
    return listingsERC1155.length;
  }

  function _createPartnerListing(address contractAddress, address currency, address splitter, uint256 price, uint256 id, uint256 tokenId) internal returns (address listing) {
    if (IERC1155(contractAddress).supportsInterface(type(IERC1155).interfaceId)) {
      listing = _createListingERC1155(contractAddress, currency, price, id, tokenId);
      getListingERC1155[contractAddress][id][tokenId] = listing;
      listingsERC1155.push(listing);
      IArtOnlineListingERC1155(listing).setSplitter(splitter);
    } else {
      listing = _createListingERC721(contractAddress, currency, price, id);
      getListing[contractAddress][id] = listing;
      listings.push(listing);
      IArtOnlineListing(listing).setSplitter(splitter);
    }
    allListings.push(listing);
    emit ListPartner(listing, allListings.length);
    return listing;
  }

  function createPartnerListing(address contractAddress, address currency, address splitter, uint256 price, uint256 id, uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) returns (address) {
    return _createPartnerListing(contractAddress, currency, splitter, price, id, tokenId);
  }

  function _createListing(address contractAddress, address currency, uint256 price, uint256 id, uint256 tokenId) internal returns (address listing) {
    if (IERC1155(contractAddress).supportsInterface(type(IERC1155).interfaceId)) {
      listing = _createListingERC1155(contractAddress, currency, price, id, tokenId);
      getListingERC1155[contractAddress][id][tokenId] = listing;
      listingsERC1155.push(listing);
    } else {
      listing = _createListingERC721(contractAddress, currency, price, id);
      getListing[contractAddress][id] = listing;
      listings.push(listing);
    }
    allListings.push(listing);
    emit List(listing, allListings.length);
    return listing;
  }

  function createPartnerListingBatch(address[] memory contractAddresses, address[] memory currencies, address[] memory splitters, uint256[] memory prices, uint256[] memory ids, uint256[] memory tokenIds) external onlyRole(DEFAULT_ADMIN_ROLE) returns (address[] memory listings) {
    listings = new address[](contractAddresses.length);
    for (uint256 i = 0; i < contractAddresses.length; i++) {
      address listing = _createPartnerListing(contractAddresses[i], currencies[i], splitters[i], prices[i], ids[i], tokenIds[i]);
      listings[i] = listing;
    }
    return listings;
  }

  function createListingBatch(address[] memory contractAddresses, address[] memory currencies, uint256[] memory prices, uint256[] memory ids, uint256[] memory tokenIds) external returns (address[] memory listings) {
    listings = new address[](contractAddresses.length);
    for (uint256 i = 0; i < contractAddresses.length; i++) {
      address listing = _createListing(contractAddresses[i], currencies[i], prices[i], ids[i], tokenIds[i]);
      listings[i] = listing;
    }
    return listings;
  }

  function createListing(address contractAddress, address currency, uint256 price, uint256 id, uint256 tokenId) external returns (address) {
    return _createListing(contractAddress, currency, price, id, tokenId);
  }

  function _createListingERC721(address contractAddress, address currency, uint256 price, uint256 id) internal returns (address listing) {
    require(getListing[contractAddress][id] == address(0), 'LISTING_EXISTS');
    bytes memory bytecode = type(ArtOnlineListing).creationCode;
    bytes32 salt = keccak256(abi.encodePacked(contractAddress, id, currency));
    assembly {
      listing := create2(0, add(bytecode, 32), mload(bytecode), salt)
    }
    IERC721(contractAddress).safeTransferFrom(_msgSender(), address(listing), id);
    ArtOnlineListing(listing).initialize(_msgSender(), contractAddress, id, price, currency);
    return listing;
  }

  function _createListingERC1155(address contractAddress, address currency, uint256 price, uint256 id, uint256 tokenId)  internal returns (address listing) {
    require(getListingERC1155[contractAddress][id][tokenId] == address(0), 'LISTING_EXISTS');
    bytes memory bytecode = type(ArtOnlineListingERC1155).creationCode;
    bytes32 salt = keccak256(abi.encodePacked(contractAddress, id, tokenId, price, currency));
    assembly {
      listing := create2(0, add(bytecode, 32), mload(bytecode), salt)
    }
    IERC1155(contractAddress).safeTransferFrom(_msgSender(), address(listing), id, tokenId, '');
    ArtOnlineListingERC1155(listing).initialize(_msgSender(), contractAddress, id, tokenId, price, currency);
    return listing;
  }

  function relist(address contractAddress, uint256 id, uint256 tokenId, uint256 price, address currency) external whenNotPaused lock {
    IArtOnlineListing listing;
    if (IERC1155(contractAddress).supportsInterface(type(IERC1155).interfaceId)) {
      require(getListingERC1155[contractAddress][id][tokenId] != address(0), 'LIST_FIRST');
      listing = IArtOnlineListing(getListingERC1155[contractAddress][id][tokenId]);
      IERC1155(contractAddress).safeTransferFrom(_msgSender(), address(listing), id, tokenId, '');
    } else {
      require(getListing[contractAddress][id] != address(0), 'LIST_FIRST');
      listing = IArtOnlineListing(getListing[contractAddress][id]);
      IERC721(contractAddress).transferFrom(_msgSender(), address(listing), id);
    }
    listing.list();
    listing.setCurrency(currency, price);
  }

  function _buyERC721(address contractAddress, uint256 id) internal {
    address listing = getListing[contractAddress][id];
    require(listing != address(0), 'LISTING_DOES_NOT_EXISTS');
    IArtOnlineListing(listing).buy{value: msg.value}(msg.sender);
    emit Sold(listing);
  }

  function _buyERC1155(address contractAddress, uint256 id, uint256 tokenId) internal {
    address listing = getListingERC1155[contractAddress][id][tokenId];
    require(listing != address(0), 'LISTING_DOES_NOT_EXISTS');
    IArtOnlineListingERC1155(listing).buy{value: msg.value}(msg.sender);
    emit Sold(listing);
  }

  function buy(address contractAddress, uint256 id, uint256 tokenId) external payable {
    if (IERC1155(contractAddress).supportsInterface(type(IERC1155).interfaceId)) {
      _buyERC1155(contractAddress, id, tokenId);
    } else {
      _buyERC721(contractAddress, id);
    }
  }

  function setSplitter(address listing, address splitter) external onlyRole(DEFAULT_ADMIN_ROLE) {
    IArtOnlineListing(listing).setSplitter(splitter);
  }

  function feeFor(uint256 amount) external view returns (uint256) {
    return (amount / 100) * _fee;
  }
}
