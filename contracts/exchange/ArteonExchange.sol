// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import './../../node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './../../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './../../node_modules/@openzeppelin/contracts/token/ERC721/IERC721.sol';
import './../../node_modules/@openzeppelin/contracts/access/Ownable.sol';
import './../gpu/ArteonGPU.sol';
import './ArteonListing.sol';

contract ArteonExchange is Ownable {
  IERC20 public ARTEON_TOKEN;

  address[] public listings;
  mapping (address => mapping(uint256 => address)) public getListing;
  mapping (address => uint256[]) private _exchange;

  event ListingCreated(address ArteonGPU, uint256 tokenId, address listing, uint, uint256 price);
  event Delist(address gpu, uint256 tokenId);
  event Relist(address gpu, uint256 tokenId, uint256 price);
  event Buy(address gpu, uint256 tokenId, address listing, uint256 price);

  constructor(address token) {
    ARTEON_TOKEN = IERC20(token);
  }

  modifier isListed(address gpu, uint256 tokenId) {
    address listing = getListing[gpu][tokenId];
    bool listed = IArteonListing(listing).isListed();
    require(listed == true, 'ArteonExchange: NOT_LISTED');
    _;
  }

  function listFor(address gpu) external view returns (uint256[] memory) {
    return _exchange[gpu];
  }

  function list(address gpu, uint256 tokenId, uint256 price) external onlyOwner returns (address listing) {
    require(getListing[gpu][tokenId] == address(0), 'ArteonExchange: LISTING_EXISTS');
    bytes memory bytecode = type(ArteonListing).creationCode;
    bytes32 salt = keccak256(abi.encodePacked(gpu, tokenId));
    assembly {
      listing := create2(0, add(bytecode, 32), mload(bytecode), salt)
    }
    IArteonListing(listing).initialize(gpu, tokenId, price);
    _exchange[gpu][tokenId] = price;
    getListing[gpu][tokenId] = listing;
    listings.push(listing);

    emit ListingCreated(gpu, tokenId, listing, listings.length, price);
  }

  function relist(address gpu, uint256 tokenId, uint256 price) external onlyOwner {
    address listing = getListing[gpu][tokenId];
    require(listing != address(0), 'ArteonExchange: LISTING_DOESNT_EXIST');

    _exchange[gpu][tokenId] = price;

    IArteonListing(listing).delist(false);
    IArteonListing(listing).setPrice(price);

    emit Relist(gpu, tokenId, price);
  }

  function delist(address gpu, uint256 tokenId) external onlyOwner isListed(gpu, tokenId) {
    address listing = getListing[gpu][tokenId];
    _removeListing(gpu, tokenId);
    IArteonListing(listing).delist(true);

    emit Delist(gpu, tokenId);
  }

  function buy(address gpu, uint256 tokenId) external isListed(gpu, tokenId) {
    address listing = getListing[gpu][tokenId];
    uint256 price = IArteonListing(listing).getPrice();
    SafeERC20.safeTransferFrom(ARTEON_TOKEN, msg.sender, address(this), price);
    IERC721(gpu).safeTransferFrom(address(this), msg.sender, tokenId);

    _removeListing(gpu, tokenId);
    IArteonListing(listing).delist(true);

    emit Buy(gpu, tokenId, listing, price);
  }

  function _removeListing(address gpu, uint256 tokenId) internal onlyOwner {
    _exchange[gpu][tokenId] = _exchange[gpu][_exchange[gpu].length - 1];
    delete _exchange[gpu][_exchange[gpu].length - 1];
  }

  function setPrice(address gpu, uint256 tokenId, uint256 price) external onlyOwner isListed(gpu, tokenId) {
    address listing = getListing[gpu][tokenId];
    IArteonListing(listing).setPrice(price);
  }

  function getPrice(address gpu, uint256 tokenId) external isListed(gpu, tokenId) returns (uint256 price) {
    address listing = getListing[gpu][tokenId];
    price = IArteonListing(listing).getPrice();
    return price;
  }

}
