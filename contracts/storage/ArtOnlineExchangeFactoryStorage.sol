// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract ArtOnlineExchangeFactoryStorage is AccessControl {
  address internal _wrappedCurrency;
  address internal _feeReceiver;
  address internal _nativeCurrency;
  uint256 internal _unlocked = 1;
  uint256 internal _fee;
  mapping(address => mapping(uint256 => address)) public getListing;
  mapping(address => mapping(uint256 => mapping(uint256 => address))) public getListingERC1155;
  address[] public allListings;
  address[] public listings;
  address[] public listingsERC1155;

  event List(address listing, uint);
  event FeeChange(uint256 oldFee, uint256 newFee);
  event Delist(address listing);
  event Sold(uint256 id, uint256 tokenId, address owner, uint256 price);
}
