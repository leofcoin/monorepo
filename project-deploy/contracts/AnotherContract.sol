// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;
import './../node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol';

contract AnotherContract is ERC721 {
  address internal _owner;
  constructor(address owner_) ERC721('ANT', 'ANT') {
    _owner = owner_;
  }
}
