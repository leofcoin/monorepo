// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract ArtOnlineExchangeStorage is AccessControl {
  address internal _artOnline;
  address internal _artOnlinePlatform;
  address internal _artOnlineStaking;

  uint internal unlocked = 1;

  struct Listing {
    uint256 price;
    uint256 listed;
    address seller;
  }

  uint256[] public listings;
  mapping(uint256 => uint256[]) public _auctions;
  mapping(uint256 => uint256[]) public _nativeListings;

  mapping(uint256 => Listing) public lists;
  mapping(uint256 => mapping(uint256 => Listing)) public auctions;
  mapping(uint256 => mapping(uint256 => Listing)) public nativeListings;

  event List(uint256 id, uint256 tokenId, uint256 price);
  event Delist(uint256 id, uint256 tokenId);
  event Sold(uint256 id, uint256 tokenId, address owner, uint256 price);
}
